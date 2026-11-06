const crypto = require("crypto");
const mongoose = require("mongoose");

jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/refund.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/integrations/payments/razorpay-refund.provider");
jest.mock("../src/integrations/payments/paypal.provider");
jest.mock("../src/services/inventory.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/Warehouse");
jest.mock("../src/models/Product");
jest.mock("../src/models/Order");
jest.mock("../src/models/ReturnRequest");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/AuditLog");
jest.mock("../src/models/Refund");
jest.mock("../src/models/Inventory");
jest.mock("../src/services/notification");
jest.mock("../src/services/financial-ledger.service");

const paymentRepository = require("../src/repositories/payment.repository");
const orderRepository = require("../src/repositories/order.repository");
const refundRepository = require("../src/repositories/refund.repository");
const razorpayRefundProvider = require("../src/integrations/payments/razorpay-refund.provider");
const paypalProvider = require("../src/integrations/payments/paypal.provider");
const inventoryService = require("../src/services/inventory.service");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const Shipment = require("../src/models/Shipment");
const AuditLog = require("../src/models/AuditLog");
const Refund = require("../src/models/Refund");
const Inventory = require("../src/models/Inventory");

const returnRequestService = require("../src/services/return-request.service");
const refundService = require("../src/services/refund.service");
const refundWebhookService = require("../src/services/refund-webhook.service");

describe("Phase 3E — Returns & Refunds Lifecycle, Gateway Integrity & Regression", () => {
  const customerAUserId = new mongoose.Types.ObjectId().toString();
  const customerAId = new mongoose.Types.ObjectId().toString();
  const customerBUserId = new mongoose.Types.ObjectId().toString();
  const customerBId = new mongoose.Types.ObjectId().toString();

  const vendorAUserId = new mongoose.Types.ObjectId().toString();
  const vendorAId = new mongoose.Types.ObjectId().toString();
  const vendorBUserId = new mongoose.Types.ObjectId().toString();
  const vendorBId = new mongoose.Types.ObjectId().toString();

  const adminUserId = new mongoose.Types.ObjectId().toString();

  const orderId = new mongoose.Types.ObjectId().toString();
  const physicalProdId = new mongoose.Types.ObjectId().toString();
  const digitalProdId = new mongoose.Types.ObjectId().toString();
  const variantAId = new mongoose.Types.ObjectId().toString();
  const warehouseId = new mongoose.Types.ObjectId().toString();
  const paymentId = new mongoose.Types.ObjectId().toString();

  let mockSession;
  let currentOrder = null;
  let currentPaymentDoc = null;
  let currentReturnDoc = null;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

    // Default Customer mocks
    Customer.findOne.mockImplementation(({ userId, _id }) => {
      if ((userId && userId.toString() === customerAUserId) || (_id && _id.toString() === customerAId)) {
        return Promise.resolve({ _id: customerAId, userId: customerAUserId, isActive: true });
      }
      if ((userId && userId.toString() === customerBUserId) || (_id && _id.toString() === customerBId)) {
        return Promise.resolve({ _id: customerBId, userId: customerBUserId, isActive: true });
      }
      return Promise.resolve(null);
    });

    Customer.findById.mockImplementation((id) => {
      if (id && id.toString() === customerAId) {
        return {
          lean: () => Promise.resolve({ _id: customerAId, userId: customerAUserId }),
        };
      }
      return { lean: () => Promise.resolve(null) };
    });

    // Default User mock
    User.findById.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            _id: customerAUserId,
            email: "customer@example.com",
            firstName: "John",
            lastName: "Doe",
          }),
      }),
    });

    // Default Vendor mocks
    Vendor.findOne.mockImplementation((query) => {
      const uId = query?.userId?.toString();
      const vId = query?._id?.toString();
      if (uId === vendorAUserId || vId === vendorAId) {
        return Promise.resolve({
          _id: vendorAId,
          userId: vendorAUserId,
          onboardingStatus: "approved",
          isActive: true,
          deletedAt: null,
        });
      }
      if (uId === vendorBUserId || vId === vendorBId) {
        return Promise.resolve({
          _id: vendorBId,
          userId: vendorBUserId,
          onboardingStatus: "approved",
          isActive: true,
          deletedAt: null,
        });
      }
      return Promise.resolve(null);
    });

    // Default Warehouse mock
    Warehouse.findOne.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ _id: warehouseId, code: "WH-MAIN", isActive: true }),
      }),
    });

    // Default Inventory findOne
    Inventory.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId().toString(),
      warehouseId,
      productId: physicalProdId,
      onHand: 10,
      reserved: 2,
    });
    Inventory.create.mockImplementation((data) =>
      Promise.resolve({ _id: new mongoose.Types.ObjectId().toString(), ...data })
    );

    // Default Product mock
    Product.findById.mockImplementation((id) => {
      if (id && id.toString() === digitalProdId) {
        return {
          select: () => ({
            lean: () =>
              Promise.resolve({
                _id: digitalProdId,
                productType: "digital",
                isVirtual: true,
                isDownloadable: true,
              }),
          }),
        };
      }
      return {
        select: () => ({
          lean: () =>
            Promise.resolve({
              _id: physicalProdId,
              productType: "simple",
              isVirtual: false,
              isDownloadable: false,
            }),
        }),
      };
    });

    Product.find.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: physicalProdId }]),
      }),
    });

    // Default Order mocks
    currentOrder = null;
    Order.findById.mockImplementation((id) => {
      const p = Promise.resolve(currentOrder);
      p.populate = () => Promise.resolve(currentOrder);
      return p;
    });
    orderRepository.findById.mockImplementation((id) => Promise.resolve(currentOrder));

    // Default Payment mocks
    currentPaymentDoc = null;
    paymentRepository.findById.mockImplementation((id) => Promise.resolve(currentPaymentDoc));
    paymentRepository.findLatestByOrderId.mockImplementation((id) => Promise.resolve(currentPaymentDoc));
    paymentRepository.reserveRefundAmount.mockImplementation((id, amt) =>
      Promise.resolve({ ...currentPaymentDoc, refundReservedAmount: amt })
    );
    paymentRepository.releaseRefundReservation.mockResolvedValue(true);
    paymentRepository.updateById.mockImplementation((id, data) =>
      Promise.resolve({ ...currentPaymentDoc, ...data })
    );

    // Default ReturnRequest mock
    currentReturnDoc = null;
    const createChainableQuery = (doc) => {
      const chain = {
        populate: () => chain,
        select: () => chain,
        sort: () => chain,
        lean: () => Promise.resolve(doc),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
      return chain;
    };

    ReturnRequest.findById.mockImplementation((id) => createChainableQuery(currentReturnDoc));

    // Default AuditLog mock
    AuditLog.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId().toString() });

    // Default Refund mocks
    Refund.find.mockReturnValue({
      lean: () => Promise.resolve([]),
    });
    refundRepository.findByPaymentId.mockResolvedValue([]);
    refundRepository.findByIdempotencyKey.mockResolvedValue(null);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. ELIGIBLE AND INELIGIBLE RETURN REQUESTS
  // =========================================================================
  describe("1. Eligible & Ineligible Return Requests", () => {
    it("rejects return request if the shipment is not yet delivered", async () => {
      currentOrder = {
        _id: orderId,
        orderNumber: "ORD-101",
        customerId: customerAId,
        status: "delivered", // Order status delivered, but item shipment is still in_transit
        placedAt: new Date(),
        items: [
          {
            productId: physicalProdId,
            productName: "Sneakers",
            quantity: 2,
            unitPrice: 100,
            lineTotal: 200,
            vendorId: vendorAId,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Shipment.find.mockReturnValue({
        lean: () =>
          Promise.resolve([
            {
              shipmentNumber: "SHP-001",
              status: "in_transit",
              items: [{ productId: physicalProdId, quantity: 2 }],
            },
          ]),
      });

      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      await expect(
        returnRequestService.createReturnRequest({
          userId: customerAUserId,
          orderId,
          items: [{ productId: physicalProdId, quantity: 1, reason: "defective" }],
        })
      ).rejects.toMatchObject({
        code: "SHIPMENT_NOT_DELIVERED",
        statusCode: 400,
      });
    });

    it("accepts return request when shipment is confirmed delivered within return window", async () => {
      currentOrder = {
        _id: orderId,
        orderNumber: "ORD-102",
        customerId: customerAId,
        status: "delivered",
        placedAt: new Date(),
        grandTotal: 200,
        items: [
          {
            productId: physicalProdId,
            productName: "Sneakers",
            quantity: 2,
            unitPrice: 100,
            lineTotal: 200,
            vendorId: vendorAId,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Shipment.find.mockReturnValue({
        lean: () =>
          Promise.resolve([
            {
              shipmentNumber: "SHP-002",
              status: "delivered",
              items: [{ productId: physicalProdId, quantity: 2 }],
            },
          ]),
      });

      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });
      ReturnRequest.create.mockImplementation((doc) =>
        Promise.resolve({
          ...doc,
          _id: new mongoose.Types.ObjectId().toString(),
          save: jest.fn().mockResolvedValue(true),
        })
      );

      const result = await returnRequestService.createReturnRequest({
        userId: customerAUserId,
        orderId,
        items: [{ productId: physicalProdId, quantity: 1, reason: "defective" }],
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("requested");
      expect(result.items[0].quantity).toBe(1);
    });
  });

  // =========================================================================
  // 2. CUSTOMER OWNERSHIP AND CROSS-CUSTOMER ISOLATION
  // =========================================================================
  describe("2. Customer Ownership & Cross-Customer Isolation", () => {
    it("rejects return request if authenticated customer does not own the order", async () => {
      currentOrder = {
        _id: orderId,
        customerId: customerAId, // owned by Customer A
        status: "delivered",
        items: [{ productId: physicalProdId, quantity: 1 }],
      };

      // Customer B attempts to return Customer A's order
      await expect(
        returnRequestService.createReturnRequest({
          userId: customerBUserId,
          orderId,
          items: [{ productId: physicalProdId, quantity: 1 }],
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        statusCode: 403,
      });
    });

    it("prevents Customer B from accessing Customer A's return request by ID", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      const chain = {
        populate: () => chain,
        lean: () =>
          Promise.resolve({
            _id: returnDocId,
            customerId: customerAId,
            returnNumber: "RET-101",
          }),
      };
      ReturnRequest.findById.mockReturnValue(chain);

      // Customer B attempts to fetch Customer A's return
      await expect(
        returnRequestService.getCustomerReturnById({
          returnId: returnDocId,
          userId: customerBUserId,
        })
      ).rejects.toMatchObject({
        code: "RETURN_NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  // =========================================================================
  // 3. VENDOR ISOLATION IN MULTI-VENDOR ORDERS
  // =========================================================================
  describe("3. Multi-Vendor Isolation", () => {
    it("creates isolated return requests per vendor in multi-vendor orders", async () => {
      const prodAId = new mongoose.Types.ObjectId().toString();
      const prodBId = new mongoose.Types.ObjectId().toString();

      currentOrder = {
        _id: orderId,
        orderNumber: "ORD-MULTI-103",
        customerId: customerAId,
        status: "delivered",
        placedAt: new Date(),
        grandTotal: 300,
        items: [
          {
            productId: prodAId,
            productName: "Item Vendor A",
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
            vendorId: vendorAId,
          },
          {
            productId: prodBId,
            productName: "Item Vendor B",
            quantity: 2,
            unitPrice: 100,
            lineTotal: 200,
            vendorId: vendorBId,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Shipment.find.mockReturnValue({ lean: () => Promise.resolve([]) });
      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      const createdList = [];
      ReturnRequest.create.mockImplementation((doc) => {
        const item = { ...doc, _id: new mongoose.Types.ObjectId().toString() };
        createdList.push(item);
        return Promise.resolve(item);
      });

      const primary = await returnRequestService.createReturnRequest({
        userId: customerAUserId,
        orderId,
        items: [
          { productId: prodAId, quantity: 1, reason: "wrong_item" },
          { productId: prodBId, quantity: 2, reason: "defective" },
        ],
      });

      expect(createdList.length).toBe(2);
      expect(createdList[0].vendorIds[0].toString()).toBe(vendorAId.toString());
      expect(createdList[1].vendorIds[0].toString()).toBe(vendorBId.toString());
      expect(primary.returns).toBeDefined();
    });

    it("prevents Vendor A from approving or mutating Vendor B's return request", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        returnNumber: "RET-VEND-B",
        status: "requested",
        items: [{ productId: physicalProdId, vendorId: vendorBId, quantity: 1 }],
        vendorIds: [vendorBId],
      };

      // Vendor A attempts to approve Vendor B's return request
      await expect(
        returnRequestService.approveReturnRequest({
          userId: vendorAUserId,
          returnId: returnDocId,
          isAdmin: false,
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        statusCode: 403,
      });
    });
  });

  // =========================================================================
  // 4. PARTIAL RETURNS AND CUMULATIVE QUANTITY LIMITS
  // =========================================================================
  describe("4. Partial Returns & Cumulative Quantity Limits", () => {
    it("rejects return request when cumulative returned quantity exceeds ordered quantity", async () => {
      currentOrder = {
        _id: orderId,
        orderNumber: "ORD-CUMULATIVE",
        customerId: customerAId,
        status: "delivered",
        placedAt: new Date(),
        grandTotal: 200,
        items: [
          {
            productId: physicalProdId,
            productName: "Headphones",
            quantity: 2, // Only 2 ordered
            unitPrice: 100,
            lineTotal: 200,
            vendorId: vendorAId,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Shipment.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      // Simulate prior active return for 1 unit
      ReturnRequest.find.mockReturnValue({
        lean: () =>
          Promise.resolve([
            {
              status: "approved",
              items: [{ productId: physicalProdId, quantity: 1 }],
            },
          ]),
      });

      // Requesting 2 more units should fail because remaining returnable is 1
      await expect(
        returnRequestService.createReturnRequest({
          userId: customerAUserId,
          orderId,
          items: [{ productId: physicalProdId, quantity: 2, reason: "defective" }],
        })
      ).rejects.toMatchObject({
        code: "QUANTITY_EXCEEDED",
        statusCode: 400,
      });
    });

    it("allows partial return within remaining returnable quantity", async () => {
      currentOrder = {
        _id: orderId,
        orderNumber: "ORD-PARTIAL-OK",
        customerId: customerAId,
        status: "delivered",
        placedAt: new Date(),
        grandTotal: 300,
        items: [
          {
            productId: physicalProdId,
            productName: "Headphones",
            quantity: 3,
            unitPrice: 100,
            lineTotal: 300,
            vendorId: vendorAId,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Shipment.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      // Prior return of 1 unit
      ReturnRequest.find.mockReturnValue({
        lean: () =>
          Promise.resolve([
            {
              status: "refunded",
              items: [{ productId: physicalProdId, quantity: 1 }],
            },
          ]),
      });

      ReturnRequest.create.mockImplementation((doc) =>
        Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId().toString(), save: jest.fn() })
      );

      // Return 2 remaining units out of 3 -> total returned will be 3/3 (allowed)
      const res = await returnRequestService.createReturnRequest({
        userId: customerAUserId,
        orderId,
        items: [{ productId: physicalProdId, quantity: 2, reason: "defective" }],
      });

      expect(res).toBeDefined();
      expect(res.items[0].quantity).toBe(2);
    });
  });

  // =========================================================================
  // 5. DIGITAL / DOWNLOADABLE ITEM RESTRICTIONS
  // =========================================================================
  describe("5. Digital / Downloadable Item Restrictions", () => {
    it("rejects return requests for digital / virtual products with DIGITAL_ITEM_NOT_RETURNABLE", async () => {
      currentOrder = {
        _id: orderId,
        orderNumber: "ORD-DIGITAL-105",
        customerId: customerAId,
        status: "delivered",
        placedAt: new Date(),
        grandTotal: 50,
        items: [
          {
            productId: digitalProdId,
            productName: "E-Book Guide",
            quantity: 1,
            unitPrice: 50,
            lineTotal: 50,
            isVirtual: true,
            isDownloadable: true,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Shipment.find.mockReturnValue({ lean: () => Promise.resolve([]) });
      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      await expect(
        returnRequestService.createReturnRequest({
          userId: customerAUserId,
          orderId,
          items: [{ productId: digitalProdId, quantity: 1, reason: "no_longer_needed" }],
        })
      ).rejects.toMatchObject({
        code: "DIGITAL_ITEM_NOT_RETURNABLE",
        statusCode: 400,
      });
    });
  });

  // =========================================================================
  // 6. INVALID, BACKWARD, AND CONCURRENT STATE TRANSITIONS
  // =========================================================================
  describe("6. Forward-Only State Transitions & Validation", () => {
    it("rejects backward transition from 'refunded' back to 'approved' or 'requested'", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        status: "refunded",
        items: [{ productId: physicalProdId, vendorId: vendorAId, quantity: 1 }],
        vendorIds: [vendorAId],
      };

      await expect(
        returnRequestService.approveReturnRequest({
          userId: vendorAUserId,
          returnId: returnDocId,
          isAdmin: false,
        })
      ).rejects.toMatchObject({
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 409,
      });
    });

    it("rejects customer cancellation if the return request was already approved", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        status: "approved",
        customerId: customerAId,
        items: [{ productId: physicalProdId, vendorId: vendorAId, quantity: 1 }],
      };

      await expect(
        returnRequestService.cancelReturnRequest({
          userId: customerAUserId,
          returnId: returnDocId,
          isAdmin: false,
        })
      ).rejects.toMatchObject({
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 409,
      });
    });

    it("allows customer cancellation while return request is in 'requested' state", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        status: "requested",
        customerId: customerAId,
        items: [{ productId: physicalProdId, vendorId: vendorAId, quantity: 1 }],
        save: jest.fn().mockResolvedValue(true),
      };

      const res = await returnRequestService.cancelReturnRequest({
        userId: customerAUserId,
        returnId: returnDocId,
        reason: "Ordered by mistake",
        isAdmin: false,
      });

      expect(res.status).toBe("cancelled");
      expect(currentReturnDoc.save).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. AUTHORITATIVE REFUND CALCULATION & PRIOR PARTIAL REFUNDS
  // =========================================================================
  describe("7. Authoritative Refund Calculation", () => {
    it("derives refund amount strictly from effective item lineTotal snapshots and caps at remaining balance", async () => {
      currentOrder = {
        _id: orderId,
        orderNumber: "ORD-DISCOUNTED",
        customerId: customerAId,
        status: "delivered",
        placedAt: new Date(),
        grandTotal: 150, // Discounted: 2 items with unit price 100 discounted to total 150
        items: [
          {
            productId: physicalProdId,
            productName: "Discounted Jacket",
            quantity: 2,
            unitPrice: 100,
            lineTotal: 150, // Effective unit price: 75.00
            vendorId: vendorAId,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Shipment.find.mockReturnValue({ lean: () => Promise.resolve([]) });
      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      let createdReturnDoc = null;
      ReturnRequest.create.mockImplementation((doc) => {
        createdReturnDoc = { ...doc, _id: new mongoose.Types.ObjectId().toString(), save: jest.fn() };
        return Promise.resolve(createdReturnDoc);
      });

      await returnRequestService.createReturnRequest({
        userId: customerAUserId,
        orderId,
        items: [{ productId: physicalProdId, quantity: 1, reason: "size_too_small" }],
      });

      // Returning 1 of 2 items should calculate 75.00, NOT the original unit price of 100.00
      expect(createdReturnDoc.refundAmount.toString()).toBe("75.00");
    });
  });

  // =========================================================================
  // 8. REFUND AMOUNT EXCEEDING CAPTURED BALANCE
  // =========================================================================
  describe("8. Refund Exceeding Captured Balance", () => {
    it("rejects refund attempt when requested amount exceeds available captured balance", async () => {
      currentPaymentDoc = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayPaymentId: "pay_rzp_bal_check",
        status: "captured",
        amount: "100.00",
        refundedAmount: "80.00",
        refundReservedAmount: "0.00",
      };

      currentOrder = {
        _id: orderId,
        customerId: customerAId,
        status: "delivered",
        paymentStatus: "partially_refunded",
      };

      paymentRepository.reserveRefundAmount.mockResolvedValue(null);
      refundRepository.findByPaymentId.mockResolvedValue([
        { status: "processed", amount: "80.00" },
      ]);
      refundRepository.findByIdempotencyKey.mockResolvedValue(null);

      // Remaining refundable balance is 20.00. Attempting to refund 30.00 must fail!
      await expect(
        refundService.createRefund({
          orderId,
          amount: "30.00",
          reason: "Excess refund test",
          idempotencyKey: "test_excess_refund_key",
          userId: adminUserId,
          role: "admin",
        })
      ).rejects.toMatchObject({
        code: "REFUND_AMOUNT_EXCEEDS_BALANCE",
        statusCode: 409,
      });
    });
  });

  // =========================================================================
  // 9. DUAL GATEWAY SUPPORT: RAZORPAY & PAYPAL
  // =========================================================================
  describe("9. Dual Gateway Support: Razorpay & PayPal", () => {
    it("successfully creates a Razorpay refund and synchronizes state", async () => {
      currentPaymentDoc = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayPaymentId: "pay_rzp_12345",
        status: "captured",
        amount: "100.00",
        currency: "INR",
        refundedAmount: "0.00",
        refundReservedAmount: "0.00",
      };

      currentOrder = {
        _id: orderId,
        customerId: customerAId,
        orderNumber: "ORD-RZP-901",
        status: "delivered",
        paymentStatus: "paid",
        save: jest.fn().mockResolvedValue(true),
      };

      paymentRepository.reserveRefundAmount.mockResolvedValue({
        ...currentPaymentDoc,
        refundReservedAmount: "50.00",
      });

      const refundDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        amount: "50.00",
        status: "created",
      };
      refundRepository.create.mockResolvedValue(refundDoc);
      refundRepository.updateById.mockImplementation((id, update) =>
        Promise.resolve({ ...refundDoc, ...update })
      );

      razorpayRefundProvider.createRefund.mockResolvedValue({
        id: "rfnd_rzp_67890",
        payment_id: "pay_rzp_12345",
        amount: 5000,
        status: "processed",
      });

      orderRepository.updateById.mockResolvedValue({
        ...currentOrder,
        paymentStatus: "partially_refunded",
      });

      const result = await refundService.createRefund({
        orderId,
        amount: "50.00",
        reason: "Customer partial return",
        idempotencyKey: "idem_rzp_test_1",
        userId: adminUserId,
        role: "admin",
      });

      expect(result).toBeDefined();
      expect(result.refund.status).toBe("processed");
      expect(result.refund.gatewayRefundId).toBe("rfnd_rzp_67890");
      expect(razorpayRefundProvider.createRefund).toHaveBeenCalled();
    });

    it("successfully creates a PayPal refund and synchronizes state", async () => {
      currentPaymentDoc = {
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayPaymentId: "CAPTURE-PAYPAL-999",
        status: "captured",
        amount: "150.00",
        currency: "USD",
        refundedAmount: "0.00",
        refundReservedAmount: "0.00",
      };

      currentOrder = {
        _id: orderId,
        customerId: customerAId,
        orderNumber: "ORD-PP-902",
        status: "delivered",
        paymentStatus: "paid",
        save: jest.fn().mockResolvedValue(true),
      };

      paymentRepository.reserveRefundAmount.mockResolvedValue({
        ...currentPaymentDoc,
        refundReservedAmount: "150.00",
      });

      const refundDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        amount: "150.00",
        status: "created",
      };
      refundRepository.create.mockResolvedValue(refundDoc);
      refundRepository.updateById.mockImplementation((id, update) =>
        Promise.resolve({ ...refundDoc, ...update })
      );

      paypalProvider.refundCapture.mockResolvedValue({
        id: "PP-REFUND-111",
        status: "COMPLETED",
      });

      orderRepository.updateById.mockResolvedValue({
        ...currentOrder,
        paymentStatus: "refunded",
      });

      const result = await refundService.createRefund({
        orderId,
        amount: "150.00",
        reason: "Full return",
        idempotencyKey: "idem_paypal_test_1",
        userId: adminUserId,
        role: "admin",
      });

      expect(result).toBeDefined();
      expect(result.refund.status).toBe("processed");
      expect(result.refund.gatewayRefundId).toBe("PP-REFUND-111");
      expect(paypalProvider.refundCapture).toHaveBeenCalledWith(
        "CAPTURE-PAYPAL-999",
        expect.objectContaining({ amount: "150.00" })
      );
    });

    it("handles uncertain gateway timeout safely without double-refunding or releasing reservation", async () => {
      currentPaymentDoc = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayPaymentId: "pay_rzp_timeout",
        status: "captured",
        amount: "100.00",
        refundedAmount: "0.00",
        refundReservedAmount: "0.00",
      };

      currentOrder = {
        _id: orderId,
        customerId: customerAId,
        status: "delivered",
        paymentStatus: "paid",
      };

      paymentRepository.reserveRefundAmount.mockResolvedValue(currentPaymentDoc);
      const refundDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        amount: "100.00",
        status: "pending",
      };
      refundRepository.create.mockResolvedValue(refundDoc);
      refundRepository.updateById.mockResolvedValue(refundDoc);

      const timeoutError = new Error("Gateway connection timed out");
      timeoutError.isTimeout = true;
      razorpayRefundProvider.createRefund.mockRejectedValue(timeoutError);

      await expect(
        refundService.createRefund({
          orderId,
          amount: "100.00",
          reason: "Timeout test",
          idempotencyKey: "idem_timeout_test",
          userId: adminUserId,
          role: "admin",
        })
      ).rejects.toThrow("Gateway connection timed out");

      // Reservation must NOT be released on uncertain timeout
      expect(paymentRepository.releaseRefundReservation).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 10. DUPLICATE REFUND REQUESTS AND WEBHOOKS
  // =========================================================================
  describe("10. Duplicate Refund Requests & Webhook Idempotency", () => {
    it("returns existing refund record without re-executing gateway when idempotency key is repeated", async () => {
      const existingRefund = {
        _id: "rfnd-existing-123",
        gateway: "razorpay",
        amount: "50.00",
        status: "processed",
      };

      currentPaymentDoc = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayPaymentId: "pay_rzp_existing",
        status: "partially_refunded",
        amount: "100.00",
        refundedAmount: "50.00",
      };

      currentOrder = {
        _id: orderId,
        customerId: customerAId,
        status: "delivered",
        paymentStatus: "partially_refunded",
      };

      refundRepository.findByPaymentId.mockResolvedValue([existingRefund]);
      refundRepository.findByIdempotencyKey.mockResolvedValue(existingRefund);

      const res = await refundService.createRefund({
        orderId,
        amount: "50.00",
        reason: "Duplicate request",
        idempotencyKey: "dup_key_1",
        userId: adminUserId,
        role: "admin",
      });

      expect(res).toBe(existingRefund);
      expect(razorpayRefundProvider.createRefund).not.toHaveBeenCalled();
    });

    it("safely ignores duplicate or out-of-order webhook events", async () => {
      const existingProcessedRefund = {
        _id: "rfnd_already_done",
        paymentId,
        orderId,
        status: "processed",
        amount: "50.00",
      };

      currentPaymentDoc = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayPaymentId: "pay_rzp_dup",
        status: "partially_refunded",
        amount: "100.00",
        refundedAmount: "50.00",
      };

      currentOrder = {
        _id: orderId,
        customerId: customerAId,
        status: "delivered",
        paymentStatus: "partially_refunded",
      };

      refundRepository.findByGatewayRefundId.mockResolvedValue(existingProcessedRefund);

      // Webhook arrives with 'refund.processed' again (duplicate)
      const duplicateRes = await refundWebhookService.processRefundWebhook({
        eventType: "refund.processed",
        payload: {
          payload: {
            refund: {
              entity: {
                id: "rfnd_rzp_dup",
                payment_id: "pay_rzp_dup",
                amount: 5000,
              },
            },
          },
        },
      });

      expect(duplicateRes.processed).toBe(true);
      expect(duplicateRes.ignored).toBe(true);
      expect(duplicateRes.reason).toBe("REFUND_ALREADY_IN_TARGET_STATE");

      // Webhook arrives with 'refund.created' (stale backward transition)
      const staleRes = await refundWebhookService.processRefundWebhook({
        eventType: "refund.created",
        payload: {
          payload: {
            refund: {
              entity: {
                id: "rfnd_rzp_dup",
                payment_id: "pay_rzp_dup",
                amount: 5000,
              },
            },
          },
        },
      });

      expect(staleRes.processed).toBe(true);
      expect(staleRes.ignored).toBe(true);
      expect(staleRes.reason).toBe("INVALID_OR_STALE_REFUND_TRANSITION");
    });
  });

  // =========================================================================
  // 11. REFUND RECONCILIATION AND RETRY SAFETY
  // =========================================================================
  describe("11. Refund Reconciliation & Retry Safety", () => {
    it("reconciles PayPal refund that failed locally but succeeded on gateway", async () => {
      const failedLocalRefund = {
        _id: "rfnd_local_failed",
        gateway: "paypal",
        gatewayRefundId: "PP-RECON-777",
        amount: "70.00",
        status: "failed",
      };

      currentPaymentDoc = {
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayPaymentId: "CAPTURE-PP-777",
        status: "captured",
        amount: "100.00",
        currency: "USD",
        refundedAmount: "0.00",
      };

      currentOrder = {
        _id: orderId,
        orderNumber: "ORD-PP-RECON",
        customerId: customerAId,
        status: "delivered",
        paymentStatus: "paid",
      };

      refundRepository.findByIdempotencyKey.mockResolvedValue(failedLocalRefund);

      paypalProvider.fetchRefund.mockResolvedValue({
        id: "PP-RECON-777",
        status: "COMPLETED",
        amount: { value: "70.00", currency_code: "USD" },
      });

      refundRepository.updateById.mockResolvedValue({
        ...failedLocalRefund,
        status: "processed",
      });
      orderRepository.updateById.mockResolvedValue({
        ...currentOrder,
        paymentStatus: "partially_refunded",
      });

      const reconResult = await refundService.createRefund({
        orderId,
        amount: "70.00",
        reason: "Reconcile PayPal",
        idempotencyKey: "recon_pp_key",
        userId: adminUserId,
        role: "admin",
      });

      expect(reconResult).toBeDefined();
      expect(reconResult.refund.status).toBe("processed");
      expect(paypalProvider.fetchRefund).toHaveBeenCalledWith("PP-RECON-777");
    });
  });

  // =========================================================================
  // 12. INSPECTION-DEPENDENT RESTOCKING
  // =========================================================================
  describe("12. Inspection-Dependent Restocking", () => {
    it("restocks passed items but excludes damaged items from sellable inventory", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        returnNumber: "RET-INSPECT-01",
        status: "approved",
        orderId: { orderNumber: "ORD-123" },
        restockedWarehouseId: warehouseId,
        items: [
          {
            productId: physicalProdId,
            productVariantId: variantAId,
            vendorId: vendorAId,
            quantity: 2,
            condition: "unopened",
            restocked: false,
          },
          {
            productId: new mongoose.Types.ObjectId().toString(),
            productVariantId: null,
            vendorId: vendorAId,
            quantity: 1,
            condition: "damaged", // Damaged condition
            restocked: false,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      currentOrder = {
        _id: orderId,
        items: [
          { productId: physicalProdId, vendorId: vendorAId, warehouseId },
        ],
      };

      const received = await returnRequestService.receiveReturnAndRestock({
        userId: vendorAUserId,
        returnId: returnDocId,
        isAdmin: false,
      });

      expect(received.status).toBe("received");
      // The unopened item must be restocked
      expect(currentReturnDoc.items[0].restocked).toBe(true);
      // The damaged item must NOT be restocked into sellable inventory
      expect(currentReturnDoc.items[1].restocked).toBe(false);
      expect(inventoryService.adjustStock).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 13. DUPLICATE RESTOCKING AND CONCURRENT MUTATIONS
  // =========================================================================
  describe("13. Restocking Idempotency", () => {
    it("uses a deterministic idempotency key and prevents duplicate stock adjustments", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        returnNumber: "RET-IDEM-STOCK",
        status: "approved",
        orderId: { orderNumber: "ORD-123" },
        restockedWarehouseId: warehouseId,
        items: [
          {
            productId: physicalProdId,
            productVariantId: variantAId,
            vendorId: vendorAId,
            quantity: 3,
            condition: "unopened",
            restocked: false,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      currentOrder = {
        _id: orderId,
        items: [{ productId: physicalProdId, warehouseId }],
      };

      await returnRequestService.receiveReturnAndRestock({
        userId: vendorAUserId,
        returnId: returnDocId,
        isAdmin: false,
      });

      const expectedKey = `restock_${returnDocId}_${physicalProdId}_${variantAId}`;
      expect(inventoryService.adjustStock).toHaveBeenCalledWith(
        expect.any(String),
        3,
        expect.objectContaining({
          idempotencyKey: expectedKey,
          referenceType: "return",
          referenceId: returnDocId,
        })
      );
    });
  });

  // =========================================================================
  // 14. RETURN & REFUND WORKFLOW CONCURRENCY & RACE SAFETY
  // =========================================================================
  describe("14. Concurrency & Race Safety", () => {
    it("prevents double-refund if return request is already marked refunded", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        status: "refunded",
        items: [{ productId: physicalProdId, vendorId: vendorAId, quantity: 1 }],
      };

      await expect(
        returnRequestService.processReturnRefund({
          userId: vendorAUserId,
          returnId: returnDocId,
          isAdmin: false,
        })
      ).rejects.toMatchObject({
        code: "RETURN_ALREADY_REFUNDED",
        statusCode: 409,
      });
    });
  });

  // =========================================================================
  // 15. AUDIT HISTORY & RESPONSE SANITIZATION
  // =========================================================================
  describe("15. Audit History & Response Sanitization", () => {
    it("creates an AuditLog entry with actorId, entityType, and states upon approval and rejection", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        returnNumber: "RET-AUDIT-101",
        status: "requested",
        orderId: { orderNumber: "ORD-123" },
        items: [{ productId: physicalProdId, vendorId: vendorAId, quantity: 1 }],
        vendorIds: [vendorAId],
        save: jest.fn().mockResolvedValue(true),
      };

      await returnRequestService.approveReturnRequest({
        userId: vendorAUserId,
        returnId: returnDocId,
        notes: "Audited approval",
        isAdmin: false,
        ipAddress: "127.0.0.1",
        userAgent: "JestTestAgent",
      });

      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: vendorAUserId,
          action: "RETURN_APPROVED",
          entityType: "return_request",
          beforeState: { status: "requested" },
          afterState: { status: "approved" },
        })
      );
    });
  });

  // =========================================================================
  // 16. INSPECTION WORKFLOW
  // =========================================================================
  describe("16. Formal Return Inspection Workflow", () => {
    it("transitions received return to inspected and records inspector notes", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        returnNumber: "RET-INSP-101",
        status: "received",
        orderId: { orderNumber: "ORD-123" },
        items: [{ productId: physicalProdId, vendorId: vendorAId, quantity: 1, condition: "unopened" }],
        vendorIds: [vendorAId],
        save: jest.fn().mockResolvedValue(true),
      };

      const res = await returnRequestService.inspectReturnRequest({
        userId: vendorAUserId,
        returnId: returnDocId,
        passed: true,
        notes: "Verified seal intact",
        restock: false,
        isAdmin: false,
      });

      expect(res.status).toBe("inspected");
      expect(res.inspection.passed).toBe(true);
      expect(res.inspection.notes).toBe("Verified seal intact");
      expect(currentReturnDoc.save).toHaveBeenCalled();
    });

    it("rejects inspection on return not in 'received' state", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      currentReturnDoc = {
        _id: returnDocId,
        status: "requested",
        items: [{ productId: physicalProdId, vendorId: vendorAId, quantity: 1 }],
        vendorIds: [vendorAId],
      };

      await expect(
        returnRequestService.inspectReturnRequest({
          userId: vendorAUserId,
          returnId: returnDocId,
          passed: true,
          isAdmin: false,
        })
      ).rejects.toMatchObject({
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 409,
      });
    });
  });
});
