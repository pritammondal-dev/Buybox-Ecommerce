const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const {
  checkOrderReturnEligibility,
  createReturnRequest,
  processReturnRefund,
  getReturnSlaStatus,
} = require("../src/services/return-request.service");
const { uploadEvidence } = require("../src/controllers/return-request.controller");
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

describe("Phase 4: Return Refund Amount, GST & Evidence Upload Regression Suite", () => {
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
      firstName: "Test",
      lastName: "Buyer",
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
          name: "Test Product",
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

  describe("A. Authoritative Customer-Paid & GST Refund Calculations", () => {
    test("1. Full refund of one item calculates exact paid amount including 18% GST", async () => {
      // Unit price: 1000.00, 18% GST: 180.00, Line Total: 1000.00, Grand Total: 1180.00
      const orderItemId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-FULL-01",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("1180.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: { state: "WB", country: "IN" },
        taxSummary: { pricingMode: "tax_exclusive" },
        items: [
          {
            _id: orderItemId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Mechanical Keyboard",
            sku: "KB-01",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("180.00"),
            taxDetails: {
              taxRate: mongoose.Types.Decimal128.fromString("18.00"),
              taxAmount: mongoose.Types.Decimal128.fromString("180.00"),
              pricingMode: "tax_exclusive",
              jurisdictionState: "WB",
            },
            vendorId,
            fulfillmentStatus: "delivered",
            save: jest.fn().mockResolvedValue(true),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

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
            orderItemId: orderItemId.toString(),
            productId: mockOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "defective",
          },
        ],
      });

      expect(res).toBeDefined();
      expect(Number(res.refundAmount.toString())).toBe(1180.0);
      expect(Number(res.taxRefundTotal.toString())).toBe(180.0);
      expect(Number(res.netItemRefundTotal.toString())).toBe(1000.0);

      const itemRes = res.items[0];
      expect(Number(itemRes.customerPaidAmount.toString())).toBe(1180.0);
      expect(Number(itemRes.taxRefund.toString())).toBe(180.0);
      // Intra-state WB -> WB: 50% CGST + 50% SGST
      expect(Number(itemRes.taxBreakdown.cgst.toString())).toBe(90.0);
      expect(Number(itemRes.taxBreakdown.sgst.toString())).toBe(90.0);
      expect(Number(itemRes.taxBreakdown.igst.toString())).toBe(0.0);
    });

    test("2. Partial quantity refund: returning 1 of 2 units refunds exactly 50% of paid amount & tax", async () => {
      // 2 units @ 1000.00 + 18% GST (360.00) = 2360.00 total paid
      const orderItemId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-PARTIAL-02",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("2360.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: { state: "MH", country: "IN" }, // Inter-state: WB vendor -> MH buyer
        taxSummary: { pricingMode: "tax_exclusive" },
        items: [
          {
            _id: orderItemId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Studio Headphones",
            sku: "HP-02",
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("360.00"),
            taxDetails: {
              taxRate: mongoose.Types.Decimal128.fromString("18.00"),
              taxAmount: mongoose.Types.Decimal128.fromString("360.00"),
              pricingMode: "tax_exclusive",
              jurisdictionState: "WB",
            },
            vendorId,
            fulfillmentStatus: "delivered",
            save: jest.fn().mockResolvedValue(true),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

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
            orderItemId: orderItemId.toString(),
            productId: mockOrder.items[0].productId.toString(),
            quantity: 1, // 1 of 2
            reason: "size_fit_issue",
          },
        ],
      });

      expect(Number(res.refundAmount.toString())).toBe(1180.0);
      expect(Number(res.taxRefundTotal.toString())).toBe(180.0);
      expect(Number(res.netItemRefundTotal.toString())).toBe(1000.0);

      const itemRes = res.items[0];
      // Inter-state WB -> MH: 100% IGST
      expect(Number(itemRes.taxBreakdown.igst.toString())).toBe(180.0);
      expect(Number(itemRes.taxBreakdown.cgst.toString())).toBe(0.0);
      expect(Number(itemRes.taxBreakdown.sgst.toString())).toBe(0.0);
    });

    test("3. Multiple products returned together match the exact illustrative prompt example", async () => {
      // Product A: ₹1,180 (1 of 1) -> ₹1,180
      // Product B: ₹2,360 (1 of 2) -> ₹1,180
      // Product C: ₹590 (1 of 1)   -> ₹590
      // Total Expected = ₹2,950
      const itemAId = new mongoose.Types.ObjectId();
      const itemBId = new mongoose.Types.ObjectId();
      const itemCId = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-MULTI-03",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("4130.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: { state: "WB", country: "IN" },
        taxSummary: { pricingMode: "tax_exclusive" },
        items: [
          {
            _id: itemAId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Product A",
            sku: "SKU-A",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("180.00"),
            vendorId,
            fulfillmentStatus: "delivered",
            save: jest.fn().mockResolvedValue(true),
          },
          {
            _id: itemBId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Product B",
            sku: "SKU-B",
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("360.00"),
            vendorId,
            fulfillmentStatus: "delivered",
            save: jest.fn().mockResolvedValue(true),
          },
          {
            _id: itemCId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Product C",
            sku: "SKU-C",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("500.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("500.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("90.00"),
            vendorId,
            fulfillmentStatus: "delivered",
            save: jest.fn().mockResolvedValue(true),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

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
          { orderItemId: itemAId.toString(), productId: mockOrder.items[0].productId.toString(), quantity: 1, reason: "defective" },
          { orderItemId: itemBId.toString(), productId: mockOrder.items[1].productId.toString(), quantity: 1, reason: "wrong_item" },
          { orderItemId: itemCId.toString(), productId: mockOrder.items[2].productId.toString(), quantity: 1, reason: "quality_issue" },
        ],
      });

      expect(Number(res.refundAmount.toString())).toBe(2950.0);
      expect(Number(res.taxRefundTotal.toString())).toBe(450.0); // 180 + 180 + 90 = 450
      expect(Number(res.netItemRefundTotal.toString())).toBe(2500.0); // 1000 + 1000 + 500 = 2500
    });

    test("4. Order-level coupon discount is accurately deducted proportionally from refund", async () => {
      // LineTotal: ₹2,000, Coupon Discount: ₹200, Tax (18% on ₹1,800): ₹324. Total Paid: ₹2,124.
      // Customer returns 1 of 2 units -> Refund should be exactly ₹1,062.00 (Base ₹900, Tax ₹162, Disc ₹100)
      const orderItemId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-COUPON-04",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("2124.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: { state: "WB", country: "IN" },
        taxSummary: { pricingMode: "tax_exclusive" },
        items: [
          {
            _id: orderItemId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Discounted Jacket",
            sku: "JK-04",
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("200.00"), // Allocated coupon
            taxTotal: mongoose.Types.Decimal128.fromString("324.00"),
            taxDetails: {
              taxRate: mongoose.Types.Decimal128.fromString("18.00"),
              taxAmount: mongoose.Types.Decimal128.fromString("324.00"),
              pricingMode: "tax_exclusive",
            },
            vendorId,
            fulfillmentStatus: "delivered",
            save: jest.fn().mockResolvedValue(true),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

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
            orderItemId: orderItemId.toString(),
            productId: mockOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "size_fit_issue",
          },
        ],
      });

      expect(Number(res.refundAmount.toString())).toBe(1062.0);
      expect(Number(res.taxRefundTotal.toString())).toBe(162.0);
      expect(Number(res.discountDeductedTotal.toString())).toBe(100.0);
      expect(Number(res.netItemRefundTotal.toString())).toBe(900.0);
    });

    test("5. Multi-stage partial returns guarantee zero rounding variance on the final remainder", async () => {
      // Total customer paid: ₹999.95 for 3 units (unit cost with tax: 333.31666... paise)
      const orderItemId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-ROUNDING-05",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("999.95"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: { state: "WB", country: "IN" },
        items: [
          {
            _id: orderItemId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Precision Sensor",
            sku: "PS-05",
            quantity: 3,
            unitPrice: mongoose.Types.Decimal128.fromString("282.47"),
            lineTotal: mongoose.Types.Decimal128.fromString("847.41"),
            taxTotal: mongoose.Types.Decimal128.fromString("152.54"),
            vendorId,
            fulfillmentStatus: "delivered",
            save: jest.fn().mockResolvedValue(true),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(mockOrder);

      // Return 1: 1 unit
      ReturnRequest.create.mockImplementationOnce((data) =>
        Promise.resolve({ ...data, _id: new mongoose.Types.ObjectId() })
      );
      const res1 = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        items: [{ orderItemId: orderItemId.toString(), productId: mockOrder.items[0].productId.toString(), quantity: 1, reason: "defective" }],
      });
      const refund1Minor = Math.round(Number(res1.refundAmount.toString()) * 100);

      // Simulate Prior Return in mock
      ReturnRequest.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            items: [
              {
                orderItemId,
                quantity: 1,
                customerPaidAmount: res1.refundAmount,
                taxRefund: res1.taxRefundTotal,
              },
            ],
          },
        ]),
      });

      // Return 2: remaining 2 units
      ReturnRequest.create.mockImplementationOnce((data) =>
        Promise.resolve({ ...data, _id: new mongoose.Types.ObjectId() })
      );
      const res2 = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        items: [{ orderItemId: orderItemId.toString(), productId: mockOrder.items[0].productId.toString(), quantity: 2, reason: "defective" }],
      });
      const refund2Minor = Math.round(Number(res2.refundAmount.toString()) * 100);

      // Invariant: sum of partial refunds exactly equals 99,995 paise (₹999.95) with ZERO variance
      expect(refund1Minor + refund2Minor).toBe(99995);
      expect(refund1Minor + refund2Minor - 99995).toBe(0);
    });

    test("6. Excessive return quantity beyond remaining returnable units is strictly rejected", async () => {
      const orderItemId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-EXCESS-06",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("1000.00"),
        items: [
          {
            _id: orderItemId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Table Lamp",
            sku: "TL-06",
            quantity: 2,
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            vendorId,
            fulfillmentStatus: "delivered",
            save: jest.fn().mockResolvedValue(true),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(mockOrder);

      // Mock that 2 units were already returned
      ReturnRequest.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            items: [{ orderItemId, quantity: 2 }],
          },
        ]),
      });

      await expect(
        createReturnRequest({
          userId,
          orderId: orderId.toString(),
          type: "return",
          items: [{ orderItemId: orderItemId.toString(), productId: mockOrder.items[0].productId.toString(), quantity: 1, reason: "defective" }],
        })
      ).rejects.toThrow(/cannot exceed ordered quantity/i);
    });

    test("7. Storefront eligibility check exposes effectiveUnitPaid and itemCustomerPaidTotal", async () => {
      const orderItemId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-ELIG-07",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("1180.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        items: [
          {
            _id: orderItemId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Webcam 4K",
            sku: "WC-07",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("180.00"),
            vendorId,
            fulfillmentStatus: "delivered",
          },
        ],
      };

      Order.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrder),
      });

      const eligibility = await checkOrderReturnEligibility({
        orderId: orderId.toString(),
        userId,
      });

      expect(eligibility.isOrderEligible).toBe(true);
      const itemElig = eligibility.items[0];
      expect(itemElig.effectiveUnitPaid).toBe("1180.00");
      expect(itemElig.itemCustomerPaidTotal).toBe("1180.00");
      expect(itemElig.taxTotal).toBe("180.00");
    });
  });

  describe("B. Double-Entry General Ledger Financial Reconciliation", () => {
    test("refund reversal journal strictly balances debits and credits with zero variance", async () => {
      const refundDoc = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        amount: mongoose.Types.Decimal128.fromString("1180.00"),
        currency: "INR",
      };

      const orderDoc = {
        _id: orderId,
        items: [
          {
            vendorId,
            commissionSnapshot: { commissionRate: "0.1000" }, // 10%
          },
        ],
      };

      const journal = await financialLedgerService.postRefundReversalJournal(refundDoc, {
        orderDoc,
        vendorId,
        isSettled: false,
        actorId: userId,
        session: mockSession,
      });

      expect(journal).toBeDefined();
      expect(journal.length).toBe(3);

      const debitEntries = journal.filter((e) => e.direction === "debit");
      const creditEntries = journal.filter((e) => e.direction === "credit");

      const totalDebits = debitEntries.reduce((sum, e) => sum + Math.round(Number(e.amount.toString()) * 100), 0);
      const totalCredits = creditEntries.reduce((sum, e) => sum + Math.round(Number(e.amount.toString()) * 100), 0);

      expect(totalDebits).toBe(118000); // 118,000 paise (₹1,180.00)
      expect(totalCredits).toBe(118000);
      expect(totalDebits - totalCredits).toBe(0); // Zero variance

      const commEntry = debitEntries.find((e) => e.entryType === "commission_reversal");
      const vendorEntry = debitEntries.find((e) => e.entryType === "refund_reversal");
      const refundClearing = creditEntries[0];

      expect(Number(commEntry.amount.toString())).toBe(118.0);
      expect(Number(vendorEntry.amount.toString())).toBe(1062.0);
      expect(Number(refundClearing.amount.toString())).toBe(1180.0);
    });
  });

  describe("C. Evidence Photograph Uploads & Error Handling", () => {
    const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    test("1. Single JPEG upload with field name 'images' succeeds", async () => {
      const mockReq = {
        files: {
          images: [
            {
              originalname: "defect1.jpg",
              mimetype: "image/jpeg",
              buffer: validJpegBuffer,
              size: 1024,
            },
          ],
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await uploadEvidence(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const resData = mockRes.json.mock.calls[0][0];
      expect(resData.success).toBe(true);
      expect(resData.data.images.length).toBe(1);
      expect(resData.data.images[0]).toMatch(/\/uploads\/returns\/evidence_.*\.jpg/);
    });

    test("2. Multiple uploads (3 files) with field name 'images' succeeds", async () => {
      const mockReq = {
        files: {
          images: [
            { originalname: "photo1.jpg", mimetype: "image/jpeg", buffer: validJpegBuffer, size: 1024 },
            { originalname: "photo2.png", mimetype: "image/png", buffer: validPngBuffer, size: 2048 },
            { originalname: "photo3.jpg", mimetype: "image/jpeg", buffer: validJpegBuffer, size: 1024 },
          ],
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await uploadEvidence(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const resData = mockRes.json.mock.calls[0][0];
      expect(resData.data.images.length).toBe(3);
    });

    test("3. Upload exceeding 5MB limit is rejected with FILE_TOO_LARGE", async () => {
      const mockReq = {
        files: {
          images: [
            {
              originalname: "giant_photo.jpg",
              mimetype: "image/jpeg",
              buffer: validJpegBuffer,
              size: 6 * 1024 * 1024, // 6 MB
            },
          ],
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await expect(uploadEvidence(mockReq, mockRes)).rejects.toThrow(/exceeds the 5MB file size limit/i);
    });

    test("4. SVG vector files are strictly rejected with SVG_NOT_ALLOWED", async () => {
      const svgBuffer = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert('xss')</script></svg>");
      const mockReq = {
        files: {
          images: [
            {
              originalname: "malicious.svg",
              mimetype: "image/svg+xml",
              buffer: svgBuffer,
              size: 500,
            },
          ],
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await expect(uploadEvidence(mockReq, mockRes)).rejects.toThrow(/SVG files are not permitted/i);
    });

    test("5. Executable files (MZ / ELF) are strictly rejected", async () => {
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
      const mockReq = {
        files: {
          images: [
            {
              originalname: "payload.exe",
              mimetype: "application/x-msdownload",
              buffer: exeBuffer,
              size: 500,
            },
          ],
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await expect(uploadEvidence(mockReq, mockRes)).rejects.toThrow(/Executable files are not permitted/i);
    });

    test("6. Uploading more than 5 files is rejected with TOO_MANY_FILES", async () => {
      const mockReq = {
        files: {
          images: [
            { originalname: "1.jpg", mimetype: "image/jpeg", buffer: validJpegBuffer, size: 100 },
            { originalname: "2.jpg", mimetype: "image/jpeg", buffer: validJpegBuffer, size: 100 },
            { originalname: "3.jpg", mimetype: "image/jpeg", buffer: validJpegBuffer, size: 100 },
            { originalname: "4.jpg", mimetype: "image/jpeg", buffer: validJpegBuffer, size: 100 },
            { originalname: "5.jpg", mimetype: "image/jpeg", buffer: validJpegBuffer, size: 100 },
            { originalname: "6.jpg", mimetype: "image/jpeg", buffer: validJpegBuffer, size: 100 },
          ],
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await expect(uploadEvidence(mockReq, mockRes)).rejects.toThrow(/maximum of 5 evidence photographs/i);
    });
  });

  describe("D. Exchange Request Zero-Refund & SLA Invariants", () => {
    test("Exchange request sets refundAmount to 0.00 while preserving replacement variant", async () => {
      const orderItemId = new mongoose.Types.ObjectId();
      const replacementVariantId = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-EXCHANGE-08",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("1180.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        items: [
          {
            _id: orderItemId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Sneakers Size 9",
            sku: "SNK-09",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("180.00"),
            vendorId,
            fulfillmentStatus: "delivered",
            save: jest.fn().mockResolvedValue(true),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

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
        type: "exchange",
        replacementVariantId: replacementVariantId.toString(),
        items: [
          {
            orderItemId: orderItemId.toString(),
            productId: mockOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "size_fit_issue",
          },
        ],
      });

      expect(res.type).toBe("exchange");
      expect(Number(res.refundAmount.toString())).toBe(0.0);
      expect(res.replacementVariantId.toString()).toBe(replacementVariantId.toString());
    });

    test("Refund SLA milestone remains strictly gated by inspection approval (refundEligibleAt)", () => {
      const inLogisticsReturn = {
        type: "return",
        status: "picked_up",
        refundEligibleAt: null,
        refundTargetDeadline: null,
      };

      const slaStatus = getReturnSlaStatus(inLogisticsReturn);
      expect(slaStatus.stage).toBe("logistics_in_progress");
      expect(slaStatus.isOverdue).toBe(false);

      const inspectedReturn = {
        type: "return",
        status: "inspected",
        refundEligibleAt: new Date(),
        refundTargetDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      };

      const inspectedSla = getReturnSlaStatus(inspectedReturn);
      expect(inspectedSla.stage).toBe("refund_processing_active");
      expect(inspectedSla.isOverdue).toBe(false);
    });
  });
});

