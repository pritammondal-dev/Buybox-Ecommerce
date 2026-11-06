const mongoose = require("mongoose");
const crypto = require("crypto");

const {
  createReturnRequest,
  approveReturnRequest,
  rejectReturnRequest,
  cancelReturnRequest,
  scheduleReversePickup,
  confirmReversePickup,
  inspectReturnRequest,
  fulfillExchangeRequest,
  processReturnRefund,
  generateCreditNoteForReturn,
} = require("../src/services/return-request.service");
const { calculateVendorEligibleSettlement } = require("../src/services/vendor-settlement.service");
const financialLedgerService = require("../src/services/financial-ledger.service");
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
jest.mock("../src/models/CreditNote");
jest.mock("../src/models/AuditLog", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/VendorWallet", () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
  findOne: jest.fn().mockResolvedValue(null),
}));
jest.mock("../src/services/storefront-settings.service", () => ({
  isFeatureEnabled: jest.fn().mockResolvedValue(true),
  getActiveSettings: jest.fn().mockResolvedValue({
    policies: { returnWindowDays: 7 },
  }),
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
jest.mock("../src/services/inventory.service", () => ({
  adjustStock: jest.fn().mockResolvedValue({}),
  reserveStock: jest.fn().mockResolvedValue({}),
  releaseStock: jest.fn().mockResolvedValue({}),
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
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const CreditNote = require("../src/models/CreditNote");
const inventoryService = require("../src/services/inventory.service");

const paymentRepository = require("../src/repositories/payment.repository");
const refundRepository = require("../src/repositories/refund.repository");
const orderRepository = require("../src/repositories/order.repository");

describe("Phase REFUND-102: Cross-Module Returns, Exchanges, Refunds & Settlement Integrity Suite", () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const vendor2Id = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const returnRequestId = new mongoose.Types.ObjectId();
  const refundId = new mongoose.Types.ObjectId();
  const warehouseId = new mongoose.Types.ObjectId();
  const productId1 = new mongoose.Types.ObjectId();
  const variantId1 = new mongoose.Types.ObjectId();
  const variantId2 = new mongoose.Types.ObjectId();
  const orderItemId1 = new mongoose.Types.ObjectId();
  const orderItemId2 = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();

    Customer.findOne.mockResolvedValue({
      _id: customerId,
      userId,
      firstName: "Test",
      lastName: "Customer",
      email: "customer@example.com",
    });

    User.findById.mockResolvedValue({
      _id: userId,
      role: "customer",
    });

    Warehouse.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: warehouseId, isActive: true }),
      }),
    });

    Shipment.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    ReturnRequest.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    Refund.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    Product.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          productType: "physical",
          isVirtual: false,
          isDownloadable: false,
        }),
      }),
    });

    CreditNote.findOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(null),
    });
    CreditNote.create.mockImplementation((data) =>
      Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...(Array.isArray(data) ? data[0] : data),
        issuedAt: new Date(),
      })
    );
  });

  const buildStandardOrder = (overrides = {}) => ({
    _id: orderId,
    orderNumber: "ORD-REFUND-102-TEST",
    customerId,
    vendorIds: [vendorId],
    status: "delivered",
    fulfillmentStatus: "fulfilled",
    paymentStatus: "paid",
    paymentMethod: "prepaid",
    currency: "INR",
    grandTotal: mongoose.Types.Decimal128.fromString("1500.00"),
    subtotal: mongoose.Types.Decimal128.fromString("1271.19"),
    taxTotal: mongoose.Types.Decimal128.fromString("228.81"),
    items: [
      {
        _id: orderItemId1,
        productId: productId1,
        productVariantId: variantId1,
        productName: "Premium Wireless Earbuds",
        sku: "EARBUD-V1",
        quantity: 1,
        returnedQuantity: 0,
        unitPrice: mongoose.Types.Decimal128.fromString("1271.19"),
        lineTotal: mongoose.Types.Decimal128.fromString("1271.19"),
        taxTotal: mongoose.Types.Decimal128.fromString("228.81"),
        customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
        vendorId,
        fulfillmentStatus: "delivered",
        returnStatus: "none",
        deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Delivered 2 days ago
      },
    ],
    timeline: [],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  const buildStandardReturn = (order, overrides = {}) => ({
    _id: returnRequestId,
    returnNumber: "RET-102-ALPHA-01",
    orderId: order._id,
    customerId,
    vendorId,
    vendorIds: [vendorId],
    type: "return",
    status: "requested",
    refundMethod: "original_source",
    refundAmount: mongoose.Types.Decimal128.fromString("1500.00"),
    netItemRefundTotal: mongoose.Types.Decimal128.fromString("1271.19"),
    taxRefundTotal: mongoose.Types.Decimal128.fromString("228.81"),
    items: [
      {
        orderItemId: orderItemId1,
        productId: productId1,
        productVariantId: variantId1,
        name: "Premium Wireless Earbuds",
        sku: "EARBUD-V1",
        quantity: 1,
        itemPrice: mongoose.Types.Decimal128.fromString("1271.19"),
        customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
        taxRefund: mongoose.Types.Decimal128.fromString("228.81"),
        reason: "defective",
        taxBreakdown: {
          cgst: mongoose.Types.Decimal128.fromString("114.41"),
          sgst: mongoose.Types.Decimal128.fromString("114.40"),
          igst: mongoose.Types.Decimal128.fromString("0.00"),
          pricingMode: "tax_exclusive",
          taxRate: mongoose.Types.Decimal128.fromString("18.00"),
        },
      },
    ],
    timeline: [],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  // 1. Complete Return Lifecycle
  test("1. Complete return lifecycle from request to refund, GST credit note, restock, and ledger reversal", async () => {
    const mockOrder = buildStandardOrder();
    const mockRet = buildStandardReturn(mockOrder, { status: "received" });

    ReturnRequest.findById.mockResolvedValue(mockRet);
    Order.findById.mockResolvedValue(mockOrder);
    Warehouse.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: warehouseId, isActive: true }),
      }),
    });
    Inventory.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      productId: productId1,
      productVariantId: variantId1,
      sku: "EARBUD-V1",
      onHand: 10,
      reserved: 0,
    });

    // Step A: Inspect & Restock
    await inspectReturnRequest({
      userId,
      returnId: mockRet._id.toString(),
      outcome: "resellable",
      notes: "Inspection passed: in pristine sellable condition",
      isAdmin: true,
    });

    expect(mockRet.status).toBe("inspected");
    expect(mockRet.inspection.passed).toBe(true);
    expect(mockRet.inspection.restocked).toBe(true);
    expect(inventoryService.adjustStock).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ referenceType: "return" })
    );

    // Step B: Process Refund
    paymentRepository.findLatestByOrderId.mockResolvedValue({
      _id: paymentId,
      gateway: "razorpay",
      gatewayPaymentId: "pay_test_razorpay_102",
      amount: "1500.00",
      status: "captured",
    });

    const spyCreateRefund = jest.spyOn(refundService, "createRefund").mockResolvedValue({
      _id: refundId,
      orderId,
      paymentId,
      gateway: "razorpay",
      amount: "1500.00",
      status: "processed",
      processedAt: new Date(),
    });

    try {
      await processReturnRefund({
        userId,
        returnId: mockRet._id.toString(),
        notes: "Admin completed refund",
        isAdmin: true,
      });

      expect(mockRet.status).toBe("refunded");
      expect(mockRet.refundId).toEqual(refundId);
      expect(mockOrder.items[0].returnStatus).toBe("returned");
      expect(mockOrder.items[0].fulfillmentStatus).toBe("returned");
      expect(mockOrder.fulfillmentStatus).toBe("returned");

      // Verify Credit Note generated
      expect(CreditNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          creditNoteNumber: `CN-${mockRet.returnNumber}`,
          orderId: mockOrder._id,
          returnRequestId: mockRet._id,
          status: "issued",
        })
      );
    } finally {
      spyCreateRefund.mockRestore();
    }
  });

  // 2. Return Cancellation Rollback
  test("2. Return cancellation rolls back returnedQuantity, resets returnStatus to 'none', and releases reverse pickup", async () => {
    const mockOrder = buildStandardOrder({
      items: [
        {
          _id: orderItemId1,
          productId: productId1,
          productVariantId: variantId1,
          quantity: 2,
          returnedQuantity: 1,
          returnStatus: "requested",
          returnRequestId,
          customerPaidAmount: mongoose.Types.Decimal128.fromString("3000.00"),
        },
      ],
    });

    const mockRet = buildStandardReturn(mockOrder, {
      status: "requested",
      reversePickupSchedule: { status: "scheduled", carrier: "DELHIVERY" },
      items: [
        {
          orderItemId: orderItemId1,
          productId: productId1,
          quantity: 1,
        },
      ],
    });

    ReturnRequest.findById.mockResolvedValue(mockRet);
    Order.findById.mockResolvedValue(mockOrder);

    const cancelled = await cancelReturnRequest({
      userId,
      returnId: mockRet._id.toString(),
      reason: "Customer changed mind",
      isAdmin: false,
    });

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.reversePickupSchedule.status).toBe("cancelled");
    expect(mockOrder.items[0].returnedQuantity).toBe(0);
    expect(mockOrder.items[0].returnStatus).toBe("none");
    expect(mockOrder.items[0].returnRequestId).toBeNull();
    expect(mockOrder.save).toHaveBeenCalled();
  });

  // 3. Return Rejection Rollback
  test("3. Return rejection rolls back returnedQuantity, resets returnStatus to 'none', and cancels scheduled pickup", async () => {
    const mockOrder = buildStandardOrder({
      items: [
        {
          _id: orderItemId1,
          productId: productId1,
          productVariantId: variantId1,
          quantity: 1,
          returnedQuantity: 1,
          returnStatus: "requested",
          returnRequestId,
        },
      ],
    });

    const mockRet = buildStandardReturn(mockOrder, {
      status: "requested",
      reversePickupSchedule: { status: "scheduled", carrier: "DELHIVERY" },
      items: [
        {
          orderItemId: orderItemId1,
          productId: productId1,
          quantity: 1,
        },
      ],
    });

    ReturnRequest.findById.mockResolvedValue(mockRet);
    Order.findById.mockResolvedValue(mockOrder);

    const rejected = await rejectReturnRequest({
      userId,
      returnId: mockRet._id.toString(),
      reason: "Item returned did not match serial number on invoice",
      isAdmin: true,
    });

    expect(rejected.status).toBe("rejected");
    expect(rejected.reversePickupSchedule.status).toBe("cancelled");
    expect(mockOrder.items[0].returnedQuantity).toBe(0);
    expect(mockOrder.items[0].returnStatus).toBe("none");
    expect(mockOrder.items[0].returnRequestId).toBeNull();
    expect(mockOrder.save).toHaveBeenCalled();
  });

  // 4. Exchange with Lower-Value Replacement
  test("4. Exchange with lower-value replacement preserves partial refund entitlement with zero customer deductions", async () => {
    const mockOrder = buildStandardOrder({
      items: [
        {
          _id: orderItemId1,
          productId: productId1,
          productVariantId: variantId1,
          productName: "Sneakers",
          sku: "SNK-BLK-42",
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          originalUnitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("2000.00"),
          returnedQuantity: 0,
          deliveredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ],
    });

    Order.findById.mockResolvedValue(mockOrder);

    ProductVariant.findById.mockResolvedValue({
      _id: variantId2,
      productId: productId1,
      sku: "SNK-WHT-41",
      name: "Sneakers White 41",
      price: mongoose.Types.Decimal128.fromString("1500.00"), // Lower value: ₹1,500 vs ₹2,000
    });

    let createdData = null;
    ReturnRequest.create.mockImplementation((data) => {
      createdData = {
        _id: returnRequestId,
        ...data,
      };
      return Promise.resolve(createdData);
    });

    const res = await createReturnRequest({
      userId,
      orderId: mockOrder._id.toString(),
      type: "exchange",
      replacementVariantId: variantId2.toString(),
      items: [
        {
          orderItemId: orderItemId1.toString(),
          productId: productId1.toString(),
          quantity: 1,
          reason: "size_fit_issue",
        },
      ],
    });

    expect(res.type).toBe("exchange");
    expect(res.exchangePriceDiffMinor).toBe(50000); // 500.00 INR = 50,000 paise
    expect(res.refundAmount.toString()).toBe("500.00"); // Preserves 500.00 INR refund entitlement
    expect(res.replacementVariantId.toString()).toBe(variantId2.toString());
  });

  // 5. Exchange with Higher-Value Replacement
  test("5. Exchange with higher-value replacement rejects unauthorized creation (ADDITIONAL_PAYMENT_REQUIRED)", async () => {
    const mockOrder = buildStandardOrder({
      items: [
        {
          _id: orderItemId1,
          productId: productId1,
          productVariantId: variantId1,
          quantity: 1,
          originalUnitPrice: mongoose.Types.Decimal128.fromString("1500.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
          returnedQuantity: 0,
          deliveredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ],
    });

    Order.findById.mockResolvedValue(mockOrder);

    ProductVariant.findById.mockResolvedValue({
      _id: variantId2,
      productId: productId1,
      name: "Sneakers Pro",
      price: mongoose.Types.Decimal128.fromString("2200.00"), // Higher value: ₹2,200 vs ₹1,500
    });

    await expect(
      createReturnRequest({
        userId,
        orderId: mockOrder._id.toString(),
        type: "exchange",
        replacementVariantId: variantId2.toString(),
        items: [
          {
            orderItemId: orderItemId1.toString(),
            productId: productId1.toString(),
            quantity: 1,
            reason: "size_fit_issue",
          },
        ],
      })
    ).rejects.toMatchObject({
      code: "ADDITIONAL_PAYMENT_REQUIRED",
      statusCode: 400,
    });
  });

  // 6. Exchange with Same Variant
  test("6. Exchange with identical variant is rejected (SAME_VARIANT_EXCHANGE)", async () => {
    const mockOrder = buildStandardOrder({
      items: [
        {
          _id: orderItemId1,
          productId: productId1,
          productVariantId: variantId1,
          quantity: 1,
          originalUnitPrice: mongoose.Types.Decimal128.fromString("1500.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
          returnedQuantity: 0,
          deliveredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ],
    });

    Order.findById.mockResolvedValue(mockOrder);

    ProductVariant.findById.mockResolvedValue({
      _id: variantId1, // Exact same variant
      productId: productId1,
      name: "Sneakers Black 42",
      price: mongoose.Types.Decimal128.fromString("1500.00"),
    });

    await expect(
      createReturnRequest({
        userId,
        orderId: mockOrder._id.toString(),
        type: "exchange",
        replacementVariantId: variantId1.toString(),
        items: [
          {
            orderItemId: orderItemId1.toString(),
            productId: productId1.toString(),
            quantity: 1,
            reason: "size_fit_issue",
          },
        ],
      })
    ).rejects.toMatchObject({
      code: "SAME_VARIANT_EXCHANGE",
      statusCode: 400,
    });
  });

  // 7. Exchange Fulfillment Phantom Stock Guard
  test("7. Exchange fulfillment throws INSUFFICIENT_EXCHANGE_INVENTORY when warehouse stock is unavailable", async () => {
    const mockOrder = buildStandardOrder();
    const mockRet = buildStandardReturn(mockOrder, {
      type: "exchange",
      status: "inspected",
      replacementVariantId: variantId2,
    });

    ReturnRequest.findById.mockResolvedValue(mockRet);
    Order.findById.mockResolvedValue(mockOrder);
    ProductVariant.findById.mockResolvedValue({
      _id: variantId2,
      name: "Replacement Variant",
      sku: "REPL-SKU-01",
    });

    // Simulate inventory not found in target warehouse (null)
    Inventory.findOne.mockResolvedValue(null);

    await expect(
      fulfillExchangeRequest({
        userId,
        returnId: mockRet._id.toString(),
        replacementVariantId: variantId2.toString(),
        isAdmin: true,
      })
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_EXCHANGE_INVENTORY",
      statusCode: 409,
    });

    // Simulate inventory found but with 0 available
    Inventory.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      onHand: 1,
      reserved: 1, // Available = 0
    });

    await expect(
      fulfillExchangeRequest({
        userId,
        returnId: mockRet._id.toString(),
        replacementVariantId: variantId2.toString(),
        isAdmin: true,
      })
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_EXCHANGE_INVENTORY",
      statusCode: 409,
    });
  });

  // 8. Quality Inspection Failed / Defective Quarantine
  test("8. Quality inspection failed/defective isolates damaged stock without restocking to onHand", async () => {
    const mockOrder = buildStandardOrder();
    const mockRet = buildStandardReturn(mockOrder, { status: "received" });

    ReturnRequest.findById.mockResolvedValue(mockRet);
    Order.findById.mockResolvedValue(mockOrder);

    await inspectReturnRequest({
      userId,
      returnId: mockRet._id.toString(),
      outcome: "defective",
      passed: false,
      notes: "Product casing cracked and electronics broken",
      isAdmin: true,
    });

    expect(mockRet.status).toBe("inspected");
    expect(mockRet.inspection.passed).toBe(false);
    expect(mockRet.inspection.restocked).toBe(false);
    expect(inventoryService.adjustStock).not.toHaveBeenCalled();
  });

  // 9. Multi-Vendor Order Return Tenant Isolation
  test("9. Multi-vendor order return isolates vendor deduction without modifying unrelated vendor", async () => {
    const mockOrder = buildStandardOrder({
      vendorIds: [vendorId, vendor2Id],
      items: [
        {
          _id: orderItemId1,
          productId: productId1,
          vendorId, // Vendor 1
          quantity: 1,
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1000.00"),
          returnedQuantity: 0,
          deliveredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        {
          _id: orderItemId2,
          productId: new mongoose.Types.ObjectId(),
          vendorId: vendor2Id, // Vendor 2 (unrelated)
          quantity: 1,
          customerPaidAmount: mongoose.Types.Decimal128.fromString("2000.00"),
          returnedQuantity: 0,
          deliveredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ],
    });

    Order.findById.mockResolvedValue(mockOrder);

    let createdReturnData = null;
    ReturnRequest.create.mockImplementation((data) => {
      createdReturnData = {
        _id: returnRequestId,
        ...data,
      };
      return Promise.resolve(createdReturnData);
    });

    // Customer returns Item 1 (Vendor 1 only)
    const res = await createReturnRequest({
      userId,
      orderId: mockOrder._id.toString(),
      type: "return",
      items: [
        {
          orderItemId: orderItemId1.toString(),
          productId: productId1.toString(),
          quantity: 1,
          reason: "defective",
        },
      ],
    });

    expect(res.vendorId.toString()).toBe(vendorId.toString());
    expect(res.vendorIds.map((v) => v.toString())).toEqual([vendorId.toString()]);
    expect(res.items[0].vendorId.toString()).toBe(vendorId.toString());

    // Verify Vendor 2 is NOT in the return request
    expect(res.vendorIds.map((v) => v.toString())).not.toContain(vendor2Id.toString());
  });

  // 10. Partial Return Order Fulfillment Status
  test("10. Partial return sets item fulfillmentStatus to 'returned' while preserving order fulfillmentStatus as 'fulfilled'", async () => {
    const mockOrder = buildStandardOrder({
      fulfillmentStatus: "fulfilled",
      status: "delivered",
      items: [
        {
          _id: orderItemId1,
          productId: productId1,
          quantity: 1,
          returnedQuantity: 1,
          returnStatus: "inspected",
          fulfillmentStatus: "delivered",
        },
        {
          _id: orderItemId2,
          productId: new mongoose.Types.ObjectId(),
          quantity: 1,
          returnedQuantity: 0,
          returnStatus: "none",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    const mockRet = buildStandardReturn(mockOrder, {
      status: "inspected",
      refundAmount: mongoose.Types.Decimal128.fromString("500.00"),
      items: [
        {
          orderItemId: orderItemId1,
          productId: productId1,
          quantity: 1,
        },
      ],
    });

    ReturnRequest.findById.mockResolvedValue(mockRet);
    Order.findById.mockResolvedValue(mockOrder);

    paymentRepository.findLatestByOrderId.mockResolvedValue({
      _id: paymentId,
      gateway: "razorpay",
      gatewayPaymentId: "pay_test_partial",
      amount: "1500.00",
      status: "captured",
    });

    const spyCreateRefund = jest.spyOn(refundService, "createRefund").mockResolvedValue({
      _id: refundId,
      orderId,
      paymentId,
      gateway: "razorpay",
      amount: "500.00",
      status: "processed",
      processedAt: new Date(),
    });

    try {
      await processReturnRefund({
        userId,
        returnId: mockRet._id.toString(),
        notes: "Partial refund processed",
        isAdmin: true,
      });

      expect(mockOrder.items[0].returnStatus).toBe("returned");
      expect(mockOrder.items[0].fulfillmentStatus).toBe("returned");

      // Item 2 remains untouched
      expect(mockOrder.items[1].returnStatus).toBe("none");
      expect(mockOrder.items[1].fulfillmentStatus).toBe("delivered");

      // Order-level fulfillmentStatus preserved as fulfilled (NOT returned)
      expect(mockOrder.fulfillmentStatus).toBe("fulfilled");
      expect(mockOrder.status).toBe("delivered");
    } finally {
      spyCreateRefund.mockRestore();
    }
  });

  // 11. Full Return Transitions Order Fulfillment Status
  test("11. 100% full return transitions order fulfillmentStatus to 'returned'", async () => {
    const mockOrder = buildStandardOrder({
      fulfillmentStatus: "fulfilled",
      status: "delivered",
      items: [
        {
          _id: orderItemId1,
          productId: productId1,
          quantity: 1,
          returnedQuantity: 1,
          returnStatus: "inspected",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    const mockRet = buildStandardReturn(mockOrder, {
      status: "inspected",
      refundAmount: mongoose.Types.Decimal128.fromString("1500.00"),
      items: [
        {
          orderItemId: orderItemId1,
          productId: productId1,
          quantity: 1,
        },
      ],
    });

    ReturnRequest.findById.mockResolvedValue(mockRet);
    Order.findById.mockResolvedValue(mockOrder);

    paymentRepository.findLatestByOrderId.mockResolvedValue({
      _id: paymentId,
      gateway: "razorpay",
      gatewayPaymentId: "pay_test_full",
      amount: "1500.00",
      status: "captured",
    });

    const spyCreateRefund = jest.spyOn(refundService, "createRefund").mockResolvedValue({
      _id: refundId,
      orderId,
      paymentId,
      gateway: "razorpay",
      amount: "1500.00",
      status: "processed",
      processedAt: new Date(),
    });

    try {
      await processReturnRefund({
        userId,
        returnId: mockRet._id.toString(),
        notes: "Full refund processed",
        isAdmin: true,
      });

      expect(mockOrder.items[0].returnStatus).toBe("returned");
      expect(mockOrder.items[0].fulfillmentStatus).toBe("returned");
      expect(mockOrder.fulfillmentStatus).toBe("returned");
    } finally {
      spyCreateRefund.mockRestore();
    }
  });

  // 12. Authoritative Credit Note Generation
  test("12. generateCreditNoteForReturn creates valid CN-RET document matching refund and tax breakdown", async () => {
    const mockOrder = buildStandardOrder();
    const mockRet = buildStandardReturn(mockOrder, {
      returnNumber: "RET-CN-TEST-001",
      refundAmount: mongoose.Types.Decimal128.fromString("1500.00"),
      netItemRefundTotal: mongoose.Types.Decimal128.fromString("1271.19"),
      taxRefundTotal: mongoose.Types.Decimal128.fromString("228.81"),
      items: [
        {
          orderItemId: orderItemId1,
          productId: productId1,
          productVariantId: variantId1,
          sku: "EARBUD-V1",
          name: "Premium Wireless Earbuds",
          quantity: 1,
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
          itemPrice: mongoose.Types.Decimal128.fromString("1271.19"),
          taxRefund: mongoose.Types.Decimal128.fromString("228.81"),
          taxBreakdown: {
            cgst: mongoose.Types.Decimal128.fromString("114.41"),
            sgst: mongoose.Types.Decimal128.fromString("114.40"),
            igst: mongoose.Types.Decimal128.fromString("0.00"),
            pricingMode: "tax_exclusive",
            taxRate: mongoose.Types.Decimal128.fromString("18.00"),
          },
        },
      ],
    });

    const cn = await generateCreditNoteForReturn({
      returnDoc: mockRet,
      orderDoc: mockOrder,
      refundDoc: { _id: refundId },
    });

    expect(cn.creditNoteNumber).toBe("CN-RET-CN-TEST-001");
    expect(cn.orderNumber).toBe(mockOrder.orderNumber);
    expect(cn.status).toBe("issued");
    expect(cn.taxableAmount.toString()).toBe("1271.19");
    expect(cn.taxAmount.toString()).toBe("228.81");
    expect(cn.totalAmount.toString()).toBe("1500.00");
    expect(cn.taxBreakdown.cgst.toString()).toBe("114.41");
    expect(cn.taxBreakdown.sgst.toString()).toBe("114.40");
    expect(mockRet.creditNote.creditNoteNumber).toBe("CN-RET-CN-TEST-001");
  });

  // 13. Vendor Settlement Return Deduction Integer Arithmetic
  test("13. Vendor settlement return deduction uses customerPaidAmount with zero paise rounding drift", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "ORD-SETTLE-TEST-01",
      createdAt: new Date(),
      status: "delivered",
      deliveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Mature, delivered 30 days ago
      items: [
        {
          _id: orderItemId1,
          vendorId,
          productId: productId1,
          quantity: 2,
          returnedQuantity: 1,
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
          unitPrice: mongoose.Types.Decimal128.fromString("1500.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("3000.00"),
          settlementId: null,
          fulfillmentStatus: "delivered",
        },
      ],
    };

    const mockCompletedReturn = {
      _id: returnRequestId,
      orderId,
      status: "refunded",
      items: [
        {
          orderItemId: orderItemId1,
          productId: productId1,
          vendorId,
          quantity: 1,
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
          itemPrice: mongoose.Types.Decimal128.fromString("1500.00"),
        },
      ],
    };

    Order.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([mockOrder]),
    });

    ReturnRequest.find.mockImplementation((query) => {
      if (query?.status?.$in?.includes("refunded")) {
        return { lean: jest.fn().mockResolvedValue([mockCompletedReturn]) };
      }
      return { lean: jest.fn().mockResolvedValue([]) };
    });

    Vendor.findById.mockResolvedValue({
      _id: vendorId,
      commissionRate: 0.10,
      status: "approved",
      onboardingStatus: "approved",
      isActive: true,
    });

    const settlement = await calculateVendorEligibleSettlement({
      vendorId: vendorId.toString(),
    });

    expect(settlement.refunds).toBe(1500.00);
    expect(settlement.grossSales).toBe(3000.00);
    expect(settlement.netPayable).toBe(1350.00);
  });
});
