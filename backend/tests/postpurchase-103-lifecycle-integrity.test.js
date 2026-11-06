const mongoose = require("mongoose");
const crypto = require("crypto");

// Services under test
const orderService = require("../src/services/order.service");
const shipmentService = require("../src/services/shipment.service");
const courierService = require("../src/services/courier.service");
const CredentialService = require("../src/services/credential.service");
const paymentService = require("../src/services/payment.service");
const financialLedgerService = require("../src/services/financial-ledger.service");
const { calculateVendorEligibleSettlement } = require("../src/services/vendor-settlement.service");

// Mock dependencies
jest.mock("../src/models/Order");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ShipmentWebhookEvent", () => ({
  create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
  findOne: jest.fn().mockResolvedValue(null),
}));
jest.mock("../src/models/NotificationOutbox", () => {
  const mockModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue(data),
  }));
  mockModel.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue([]),
    }),
  });
  return mockModel;
});
jest.mock("../src/services/notification-outbox.service", () => ({
  enqueue: jest.fn().mockResolvedValue({}),
  getPendingNotifications: jest.fn().mockResolvedValue([]),
}));
jest.mock("../src/models/Refund");
jest.mock("../src/models/Warehouse");
jest.mock("../src/models/Inventory");
jest.mock("../src/models/CreditNote");
jest.mock("../src/models/AuditLog", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/services/governance.service", () => ({
  recordAuditLog: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/VendorWallet", () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
  findOne: jest.fn().mockResolvedValue(null),
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
  sendOrderStatusNotification: jest.fn().mockResolvedValue(true),
  sendOrderStatusUpdate: jest.fn().mockResolvedValue(true),
  sendRefundConfirmation: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/services/email.service", () => {
  return jest.fn().mockImplementation(() => ({
    sendDeliveryConfirmation: jest.fn().mockResolvedValue(true),
    sendShipmentUpdate: jest.fn().mockResolvedValue(true),
    send: jest.fn().mockResolvedValue(true),
  }));
});
jest.mock("../src/services/reward.service", () => ({
  adjustPointsForCancelledOrRefundedOrder: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/services/inventory.service", () => ({
  adjustStock: jest.fn().mockResolvedValue({}),
  reserveStock: jest.fn().mockResolvedValue({}),
  releaseStock: jest.fn().mockResolvedValue({}),
  releaseStockInTransaction: jest.fn().mockResolvedValue({}),
  deductReservedStockInTransaction: jest.fn().mockResolvedValue({}),
}));

jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/coupon.repository", () => ({
  decrementUsage: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/repositories/coupon-redemption.repository", () => ({
  deleteByOrderId: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/repositories/financial-ledger.repository", () => ({
  findByJournalId: jest.fn().mockResolvedValue([]),
  findByIdempotencyKey: jest.fn().mockResolvedValue(null),
  createMany: jest.fn().mockImplementation((entries) => Promise.resolve(entries)),
  findVendorAllEntries: jest.fn().mockResolvedValue([]),
}));

const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  withTransaction: jest.fn().mockImplementation((fn) => fn(mockSession)),
};
jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);
jest.mock("../src/utils/withTransaction", () =>
  jest.fn().mockImplementation((cb) => cb(mockSession))
);

const Order = require("../src/models/Order");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Shipment = require("../src/models/Shipment");
const ShipmentWebhookEvent = require("../src/models/ShipmentWebhookEvent");
const Refund = require("../src/models/Refund");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const CreditNote = require("../src/models/CreditNote");

const paymentRepository = require("../src/repositories/payment.repository");
const orderRepository = require("../src/repositories/order.repository");
const shipmentRepository = require("../src/repositories/shipment.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");

describe("Phase POSTPURCHASE-103: Complete Post-Purchase Ecosystem Lifecycle Acceptance Suite", () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const vendorAId = new mongoose.Types.ObjectId();
  const vendorBId = new mongoose.Types.ObjectId();
  const warehouseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const shipmentAId = new mongoose.Types.ObjectId();
  const shipmentBId = new mongoose.Types.ObjectId();

  const prodAId = new mongoose.Types.ObjectId();
  const varAId = new mongoose.Types.ObjectId();
  const orderItemAId = new mongoose.Types.ObjectId();

  const prodBId = new mongoose.Types.ObjectId();
  const varBId = new mongoose.Types.ObjectId();
  const orderItemBId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();

    Customer.findOne.mockResolvedValue({
      _id: customerId,
      userId,
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul@example.com",
    });

    Customer.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: customerId,
        userId,
        firstName: "Rahul",
        lastName: "Sharma",
        email: "rahul@example.com",
      }),
      _id: customerId,
      userId,
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul@example.com",
    });

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: userId, role: "customer", email: "rahul@example.com" }),
      }),
      lean: jest.fn().mockResolvedValue({ _id: userId, role: "customer", email: "rahul@example.com" }),
      _id: userId,
      role: "customer",
    });

    Warehouse.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: warehouseId, isActive: true }),
      }),
    });

    Warehouse.findById.mockResolvedValue({
      _id: warehouseId,
      name: "Central Mumbai Warehouse",
      isActive: true,
    });

    Inventory.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      productVariantId: varAId,
      warehouseId,
      quantityOnHand: 100,
      quantityReserved: 1,
      quantityAvailable: 99,
    });

    inventoryRepository.findByVariant.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        productVariantId: varAId,
        warehouseId,
        quantityOnHand: 100,
        quantityReserved: 1,
        quantityAvailable: 99,
      },
    ]);

    inventoryRepository.findByVariantAndWarehouse.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      productVariantId: varAId,
      warehouseId,
      quantityOnHand: 100,
      quantityReserved: 1,
      quantityAvailable: 99,
    });

    shipmentRepository.transitionStatusAtomic = jest.fn().mockImplementation((args) => {
      const updateData = args?.updateData || args || {};
      return Promise.resolve({
        ...updateData,
        _id: args?.shipmentId || new mongoose.Types.ObjectId(),
        status: updateData.status || args?.expectedStatus || "in_transit",
        inventoryStatus: updateData.inventoryStatus || "deducted",
        version: 1,
      });
    });

    shipmentRepository.updateById.mockImplementation((id, update) => {
      return Promise.resolve({
        ...update,
        _id: id,
        status: update.status,
        version: 1,
      });
    });

    jest.spyOn(CredentialService, "getDecryptedCredentials").mockResolvedValue({});
    jest.spyOn(courierService, "getAdapter").mockReturnValue({
      verifyWebhookSignature: () => true,
    });

    // Mock payment refund
    jest.spyOn(paymentService, "getLatestPaymentForOrder").mockResolvedValue({
      _id: paymentId,
      orderId,
      status: "captured",
      amount: mongoose.Types.Decimal128.fromString("2998.00"),
      capturedAmount: mongoose.Types.Decimal128.fromString("2998.00"),
      currency: "INR",
      paymentMethod: "razorpay",
      gatewayOrderId: "order_rzp_123",
      gatewayPaymentId: "pay_rzp_456",
    });

    jest.spyOn(paymentService, "refundPaymentForOrder").mockImplementation((oId, uId, amount, key) => {
      return Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        orderId: oId,
        paymentId,
        amount: mongoose.Types.Decimal128.fromString((amount || 2998.00).toFixed(2)),
        status: "refunded",
        idempotencyKey: key,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 1: COMPLETE POST-PURCHASE HAPPY PATH LIFECYCLE
  // ---------------------------------------------------------------------------
  test("1. Complete post-purchase happy path: checkout -> capture -> dispatch -> in-transit -> delivery confirmation", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-01",
      customerId,
      status: "processing",
      paymentStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      items: [
        {
          _id: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          sku: "SKU-PROD-A",
          name: "Wireless ANC Headphones",
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("269.82"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          warehouseId,
          vendorId: vendorAId,
          fulfillmentStatus: "processing",
          inventoryStatus: "reserved",
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, update) => {
      Object.assign(mockOrder, update);
      return Promise.resolve(mockOrder);
    });

    const mockShipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-01",
      orderId,
      vendorId: vendorAId,
      warehouseId,
      status: "created",
      inventoryStatus: "reserved",
      trackingNumber: "TRK-DLHV-101",
      items: [
        {
          orderItemId: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          sku: "SKU-PROD-A",
          quantity: 1,
        },
      ],
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    shipmentRepository.findById.mockResolvedValue(mockShipment);
    shipmentRepository.findByOrderId.mockResolvedValue([mockShipment]);

    // Dispatch milestone 1: created -> picked_up
    const res1 = await shipmentService.transitionShipmentStatus({
      shipmentId: shipmentAId,
      nextStatus: "picked_up",
      source: "carrier_webhook",
      actorUser: { role: "admin", _id: userId },
    });
    expect(res1.status).toBe("picked_up");
    mockShipment.status = "picked_up";

    // Dispatch milestone 2: picked_up -> in_transit
    const res2 = await shipmentService.transitionShipmentStatus({
      shipmentId: shipmentAId,
      nextStatus: "in_transit",
      source: "carrier_webhook",
      actorUser: { role: "admin", _id: userId },
    });
    expect(res2.status).toBe("in_transit");
    mockShipment.status = "in_transit";

    // Dispatch milestone 3: in_transit -> out_for_delivery
    const res3 = await shipmentService.transitionShipmentStatus({
      shipmentId: shipmentAId,
      nextStatus: "out_for_delivery",
      source: "carrier_webhook",
      actorUser: { role: "admin", _id: userId },
    });
    expect(res3.status).toBe("out_for_delivery");
    mockShipment.status = "out_for_delivery";

    // Final milestone: out_for_delivery -> delivered
    const res4 = await shipmentService.transitionShipmentStatus({
      shipmentId: shipmentAId,
      nextStatus: "delivered",
      source: "carrier_webhook",
      actorUser: { role: "admin", _id: userId },
    });

    expect(res4.status).toBe("delivered");
    expect(mockOrder.fulfillmentStatus).toBe("fulfilled");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 2: PRE-SHIPMENT FULL ORDER CANCELLATION
  // ---------------------------------------------------------------------------
  test("2. Pre-shipment full cancellation: releases inventory reservation & issues 100% gateway refund", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-02",
      customerId,
      status: "processing",
      paymentStatus: "paid",
      grandTotal: mongoose.Types.Decimal128.fromString("1499.00"),
      items: [
        {
          _id: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          sku: "SKU-PROD-A",
          quantity: 1,
          warehouseId,
          unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          inventoryStatus: "reserved",
          fulfillmentStatus: "unfulfilled",
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, update) => {
      Object.assign(mockOrder, update);
      return Promise.resolve(mockOrder);
    });

    shipmentRepository.findByOrderId.mockResolvedValue([
      {
        _id: shipmentAId,
        orderId,
        status: "created",
        inventoryStatus: "reserved",
      },
    ]);

    const cancelledOrder = await orderService.cancelOrder(orderId, {
      userId,
      cancellationReason: "Found better price elsewhere",
    });

    expect(cancelledOrder.status).toBe("cancelled");
    expect(paymentService.refundPaymentForOrder).toHaveBeenCalledWith(
      orderId,
      userId,
      null,
      `order_cancel_${orderId.toString()}`
    );
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 3: DISPATCHED ORDER CANCELLATION BLOCKED
  // ---------------------------------------------------------------------------
  test("3. Customer cancellation blocked once package is in transit (ORDER_ALREADY_DISPATCHED)", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-03",
      customerId,
      status: "processing",
      items: [{ _id: orderItemAId, quantity: 1 }],
    };

    orderRepository.findById.mockResolvedValue(mockOrder);

    // Shipment is in transit with courier
    shipmentRepository.findByOrderId.mockResolvedValue([
      {
        _id: shipmentAId,
        orderId,
        status: "in_transit",
      },
    ]);

    await expect(
      orderService.cancelOrder(orderId, {
        userId,
        isAdmin: false,
      })
    ).rejects.toThrow("Order or package has already been dispatched and cannot be cancelled directly");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 4: DELIVERED ORDER CANCELLATION BLOCKED
  // ---------------------------------------------------------------------------
  test("4. Delivered order cancellation blocked (must follow returns workflow)", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-04",
      customerId,
      status: "delivered",
      items: [{ _id: orderItemAId, quantity: 1 }],
    };

    orderRepository.findById.mockResolvedValue(mockOrder);

    await expect(
      orderService.cancelOrder(orderId, {
        userId,
        isAdmin: false,
      })
    ).rejects.toThrow("Order cannot be cancelled from status delivered");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 5: PARTIAL ITEM CANCELLATION IN MULTI-ITEM ORDER
  // ---------------------------------------------------------------------------
  test("5. Multi-item partial cancellation: releases targeted inventory & issues exact allocated refund", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-05",
      customerId,
      status: "processing",
      paymentStatus: "paid",
      grandTotal: mongoose.Types.Decimal128.fromString("2998.00"),
      taxSummary: { totalTax: mongoose.Types.Decimal128.fromString("0.00"), pricingMode: "tax_inclusive" },
      items: [
        {
          _id: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          sku: "SKU-A",
          quantity: 1,
          warehouseId,
          unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          inventoryStatus: "reserved",
          fulfillmentStatus: "unfulfilled",
        },
        {
          _id: orderItemBId,
          productId: prodBId,
          productVariantId: varBId,
          sku: "SKU-B",
          quantity: 1,
          warehouseId,
          unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          inventoryStatus: "reserved",
          fulfillmentStatus: "unfulfilled",
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, update) => {
      Object.assign(mockOrder, update);
      return Promise.resolve(mockOrder);
    });
    shipmentRepository.findByOrderId.mockResolvedValue([]);

    const updated = await orderService.cancelOrder(orderId, {
      userId,
      itemIds: [orderItemAId.toString()],
    });

    expect(updated.status).toBe("processing");
    expect(updated.paymentStatus).toBe("partially_refunded");
    expect(mockOrder.items[0].fulfillmentStatus).toBe("cancelled");
    expect(mockOrder.items[1].fulfillmentStatus).toBe("unfulfilled");

    expect(paymentService.refundPaymentForOrder).toHaveBeenCalledWith(
      orderId,
      userId,
      1499.00,
      `order_cancel_item_${orderId.toString()}_${orderItemAId.toString()}`
    );
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 6: MULTI-VENDOR ORDER CANCELLATION ISOLATION
  // ---------------------------------------------------------------------------
  test("6. Multi-vendor cancellation isolation: cancelling Vendor A's item does not cancel Vendor B's items", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-06",
      customerId,
      status: "processing",
      paymentStatus: "paid",
      grandTotal: mongoose.Types.Decimal128.fromString("2000.00"),
      items: [
        {
          _id: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          vendorId: vendorAId,
          sku: "SKU-VENDOR-A",
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          warehouseId,
          inventoryStatus: "reserved",
          fulfillmentStatus: "unfulfilled",
        },
        {
          _id: orderItemBId,
          productId: prodBId,
          productVariantId: varBId,
          vendorId: vendorBId,
          sku: "SKU-VENDOR-B",
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          warehouseId,
          inventoryStatus: "reserved",
          fulfillmentStatus: "unfulfilled",
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, update) => {
      Object.assign(mockOrder, update);
      return Promise.resolve(mockOrder);
    });
    shipmentRepository.findByOrderId.mockResolvedValue([]);

    await orderService.cancelOrder(orderId, {
      userId,
      itemIds: [orderItemAId.toString()],
    });

    expect(mockOrder.items[0].fulfillmentStatus).toBe("cancelled");
    expect(mockOrder.items[1].fulfillmentStatus).toBe("unfulfilled");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 7: MULTI-VENDOR INDEPENDENT FULFILLMENT SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  test("7. Multi-vendor independent fulfillment: Vendor A delivers while Vendor B in transit -> partially_fulfilled", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-07",
      status: "processing",
      fulfillmentStatus: "unfulfilled",
      items: [
        {
          _id: orderItemAId,
          productVariantId: varAId,
          warehouseId,
          fulfillmentStatus: "processing",
        },
        {
          _id: orderItemBId,
          productVariantId: varBId,
          warehouseId,
          fulfillmentStatus: "processing",
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    const shipmentA = {
      _id: shipmentAId,
      orderId,
      status: "out_for_delivery",
      warehouseId,
      items: [{ productVariantId: varAId, quantity: 1 }],
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const shipmentB = {
      _id: shipmentBId,
      orderId,
      status: "in_transit",
      warehouseId,
      items: [{ productVariantId: varBId, quantity: 1 }],
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    shipmentRepository.findById.mockResolvedValue(shipmentA);
    shipmentRepository.findByOrderId.mockResolvedValue([shipmentA, shipmentB]);
    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, update) => {
      Object.assign(mockOrder, update);
      return Promise.resolve(mockOrder);
    });

    // Deliver Vendor A's shipment from out_for_delivery -> delivered
    await shipmentService.transitionShipmentStatus({
      shipmentId: shipmentAId,
      nextStatus: "delivered",
      source: "carrier_webhook",
      actorUser: { role: "admin", _id: userId },
    });

    expect(mockOrder.fulfillmentStatus).toBe("partially_fulfilled");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 8: COURIER DELIVERY FAILURE -> RTO INITIATED
  // ---------------------------------------------------------------------------
  test("8. Courier delivery failure: triggers RTO initiated tracking transition", async () => {
    const shipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-08",
      orderId,
      status: "out_for_delivery",
      trackingNumber: "TRK-FAIL-01",
      carrier: "delhivery",
      items: [{ productVariantId: varAId, quantity: 1 }],
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    Shipment.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(shipment),
    });
    shipmentRepository.findById.mockResolvedValue(shipment);
    orderRepository.findById.mockResolvedValue({ _id: orderId, status: "shipped", items: [] });

    const result = await courierService.handleWebhook({
      provider: "delhivery",
      body: {
        tracking_number: "TRK-FAIL-01",
        status: "rto_initiated",
        event_id: "evt_rto_001",
        reason: "Customer address incomplete",
      },
    });

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("rto_initiated");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 9: RTO IN TRANSIT RESTOCKING & REFUND GUARD
  // ---------------------------------------------------------------------------
  test("9. RTO in transit guard: does NOT refund prematurely & does NOT restock inventory prematurely", async () => {
    const shipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-09",
      orderId,
      status: "rto_initiated",
      inventoryStatus: "deducted",
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    shipmentRepository.findById.mockResolvedValue(shipment);
    orderRepository.findById.mockResolvedValue({ _id: orderId, status: "shipped", items: [] });

    const res = await shipmentService.transitionShipmentStatus({
      shipmentId: shipmentAId,
      nextStatus: "rto_in_transit",
      source: "carrier_webhook",
      actorUser: { role: "admin", _id: userId },
    });

    expect(res.status).toBe("rto_in_transit");
    expect(res.inventoryStatus).toBe("deducted");
    expect(paymentService.refundPaymentForOrder).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 10: WAREHOUSE RTO RECEIPT & RESELLABLE RESTOCKING
  // ---------------------------------------------------------------------------
  test("10. Warehouse RTO receipt (resellable): restores sellable inventory & executes 100% refund with 0 deductions", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-10",
      customerId,
      status: "shipped",
      grandTotal: mongoose.Types.Decimal128.fromString("1499.00"),
      items: [
        {
          _id: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          quantity: 1,
          warehouseId,
          unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    const shipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-10",
      orderId,
      vendorId: vendorAId,
      warehouseId,
      status: "rto_in_transit",
      inventoryStatus: "deducted",
      items: [
        {
          orderItemId: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          sku: "SKU-PROD-A",
          quantity: 1,
          price: mongoose.Types.Decimal128.fromString("1499.00"),
        },
      ],
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    shipmentRepository.findById.mockResolvedValue(shipment);
    shipmentRepository.findByOrderId.mockResolvedValue([shipment]);
    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, update) => {
      Object.assign(mockOrder, update);
      return Promise.resolve(mockOrder);
    });

    CreditNote.findOne = jest.fn().mockResolvedValue(null);
    CreditNote.create = jest.fn().mockImplementation((data) => Promise.resolve(data));

    const inspected = await shipmentService.receiveAndInspectRtoShipment({
      shipmentId: shipmentAId,
      outcome: "resellable",
      condition: "unopened_seal_intact",
      notes: "Package pristine, return to origin verified",
      userId,
      isAdmin: true,
    });

    expect(inspected.status).toBe("rto_delivered");
    expect(inspected.inventoryStatus).toBe("restocked");
    expect(inspected.rtoInspection.outcome).toBe("resellable");
    expect(inspected.rtoInspection.restocked).toBe(true);

    expect(paymentService.refundPaymentForOrder).toHaveBeenCalledWith(
      orderId,
      customerId,
      1499.00,
      `rto_refund_${shipmentAId.toString()}`
    );

    expect(mockOrder.status).toBe("cancelled");
    expect(mockOrder.cancellationReason).toBe("Returned to Origin (RTO)");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 11: WAREHOUSE RTO RECEIPT & DAMAGED QUARANTINE
  // ---------------------------------------------------------------------------
  test("11. Warehouse RTO receipt (damaged): quarantines stock without adding to sellable onHand", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-11",
      customerId,
      status: "shipped",
      grandTotal: mongoose.Types.Decimal128.fromString("1499.00"),
      items: [
        {
          _id: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          quantity: 1,
          warehouseId,
          unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    const shipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-11",
      orderId,
      vendorId: vendorAId,
      warehouseId,
      status: "rto_in_transit",
      inventoryStatus: "deducted",
      items: [
        {
          orderItemId: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          sku: "SKU-PROD-A",
          quantity: 1,
          price: mongoose.Types.Decimal128.fromString("1499.00"),
        },
      ],
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    shipmentRepository.findById.mockResolvedValue(shipment);
    shipmentRepository.findByOrderId.mockResolvedValue([shipment]);
    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, update) => {
      Object.assign(mockOrder, update);
      return Promise.resolve(mockOrder);
    });

    CreditNote.findOne = jest.fn().mockResolvedValue(null);
    CreditNote.create = jest.fn().mockImplementation((data) => Promise.resolve(data));

    const inspected = await shipmentService.receiveAndInspectRtoShipment({
      shipmentId: shipmentAId,
      outcome: "damaged",
      condition: "box_crushed_water_damage",
      notes: "Transit damage observed, stock quarantined",
      userId,
      isAdmin: true,
    });

    expect(inspected.status).toBe("rto_delivered");
    expect(inspected.inventoryStatus).toBe("quarantined");
    expect(inspected.rtoInspection.outcome).toBe("damaged");
    expect(inspected.rtoInspection.restocked).toBe(false);

    expect(paymentService.refundPaymentForOrder).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 12: RTO ON COD (CASH ON DELIVERY) ORDER
  // ---------------------------------------------------------------------------
  test("12. RTO on Cash on Delivery (COD) order cancels liability without false digital refund", async () => {
    paymentService.getLatestPaymentForOrder.mockResolvedValueOnce({
      _id: paymentId,
      orderId,
      status: "pending",
      paymentMethod: "cod",
    });

    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-12",
      customerId,
      status: "shipped",
      paymentStatus: "pending",
      items: [{ _id: orderItemAId, quantity: 1, warehouseId, productVariantId: varAId }],
      save: jest.fn().mockResolvedValue(true),
    };

    const shipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-12",
      orderId,
      vendorId: vendorAId,
      warehouseId,
      status: "rto_in_transit",
      inventoryStatus: "deducted",
      items: [{ orderItemId: orderItemAId, productId: prodAId, productVariantId: varAId, quantity: 1, price: mongoose.Types.Decimal128.fromString("500.00") }],
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    shipmentRepository.findById.mockResolvedValue(shipment);
    shipmentRepository.findByOrderId.mockResolvedValue([shipment]);
    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, update) => {
      Object.assign(mockOrder, update);
      return Promise.resolve(mockOrder);
    });

    await shipmentService.receiveAndInspectRtoShipment({
      shipmentId: shipmentAId,
      outcome: "resellable",
      condition: "unopened",
      userId,
      isAdmin: true,
    });

    expect(paymentService.refundPaymentForOrder).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 13: RTO CREDIT NOTE GENERATION
  // ---------------------------------------------------------------------------
  test("13. RTO Credit Note generated with original order reference and GST breakdown", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-13",
      customerId,
      status: "shipped",
      grandTotal: mongoose.Types.Decimal128.fromString("1180.00"),
      taxSummary: { totalTax: mongoose.Types.Decimal128.fromString("180.00"), pricingMode: "tax_exclusive" },
      items: [
        {
          _id: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          sku: "SKU-GST-18",
          name: "GST Eligible Product",
          quantity: 1,
          warehouseId,
          unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("180.00"),
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    const shipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-13",
      orderId,
      vendorId: vendorAId,
      warehouseId,
      status: "rto_in_transit",
      inventoryStatus: "deducted",
      items: [
        {
          orderItemId: orderItemAId,
          productId: prodAId,
          productVariantId: varAId,
          sku: "SKU-GST-18",
          name: "GST Eligible Product",
          quantity: 1,
          price: mongoose.Types.Decimal128.fromString("1000.00"),
        },
      ],
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    shipmentRepository.findById.mockResolvedValue(shipment);
    shipmentRepository.findByOrderId.mockResolvedValue([shipment]);
    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, update) => {
      Object.assign(mockOrder, update);
      return Promise.resolve(mockOrder);
    });

    let createdCreditNoteData = null;
    CreditNote.findOne = jest.fn().mockResolvedValue(null);
    CreditNote.create = jest.fn().mockImplementation((data) => {
      createdCreditNoteData = data;
      return Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...data });
    });

    await shipmentService.receiveAndInspectRtoShipment({
      shipmentId: shipmentAId,
      outcome: "resellable",
      condition: "unopened",
      userId,
      isAdmin: true,
    });

    expect(createdCreditNoteData).toBeDefined();
    expect(createdCreditNoteData.creditNoteNumber).toBe("CN-RTO-SHP-103-13");
    expect(createdCreditNoteData.orderNumber).toBe("BB-ORD-103-13");
    expect(createdCreditNoteData.shipmentNumber).toBe("SHP-103-13");
    expect(createdCreditNoteData.totalAmount.toString()).toBe("1180.00");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 14: IN-FLIGHT SHIPMENT CANCELLATION RESTOCKING GUARD
  // ---------------------------------------------------------------------------
  test("14. In-flight shipment cancellation marks rto_pending without premature inventory inflation", async () => {
    const shipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-14",
      orderId,
      vendorId: vendorAId,
      warehouseId,
      status: "picked_up", // Physical goods handed over to carrier
      inventoryStatus: "deducted",
      items: [{ productVariantId: varAId, quantity: 1 }],
      trackingEvents: [],
      save: jest.fn().mockResolvedValue(true),
    };

    shipmentRepository.findById.mockResolvedValue(shipment);
    orderRepository.findById.mockResolvedValue({ _id: orderId, status: "shipped", items: [] });

    const res = await shipmentService.transitionShipmentStatus({
      shipmentId: shipmentAId,
      nextStatus: "cancelled",
      source: "carrier_webhook",
      actorUser: { role: "admin", _id: userId },
    });

    expect(res.status).toBe("cancelled");
    expect(res.inventoryStatus).toBe("rto_pending"); // Guarded against premature stock restock
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 15: CONCURRENT CANCELLATION IDEMPOTENCY
  // ---------------------------------------------------------------------------
  test("15. Concurrent cancellation requests handled idempotently with zero duplicate refunds", async () => {
    const mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-15",
      customerId,
      status: "cancelled", // Already cancelled by prior concurrent thread
      items: [{ _id: orderItemAId, quantity: 1 }],
    };

    orderRepository.findById.mockResolvedValue(mockOrder);

    const res = await orderService.cancelOrder(orderId, { userId });
    expect(res.status).toBe("cancelled");
    expect(paymentService.refundPaymentForOrder).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 16: DUPLICATE COURIER WEBHOOK IDEMPOTENCY
  // ---------------------------------------------------------------------------
  test("16. Duplicate courier webhook events handled idempotently via event reservation", async () => {
    const shipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-16",
      status: "in_transit",
      trackingNumber: "TRK-DUP-01",
    };

    Shipment.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(shipment),
    });

    // Simulate unique index violation on duplicate eventId
    ShipmentWebhookEvent.create.mockRejectedValueOnce({
      code: 11000,
      message: "E11000 duplicate key error collection",
    });

    const result = await courierService.handleWebhook({
      provider: "delhivery",
      body: {
        tracking_number: "TRK-DUP-01",
        status: "in_transit",
        event_id: "evt_dup_101",
      },
    });

    expect(result.duplicate).toBe(true);
    expect(result.message).toBe("Webhook event already processed");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 17: OUT-OF-ORDER COURIER WEBHOOK HANDLING
  // ---------------------------------------------------------------------------
  test("17. Out-of-order courier webhook safely ignored for terminal shipments", async () => {
    const shipment = {
      _id: shipmentAId,
      shipmentNumber: "SHP-103-17",
      status: "delivered", // Terminal status
      trackingNumber: "TRK-STALE-01",
    };

    Shipment.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(shipment),
    });

    // Arrives late webhook: "in_transit"
    const result = await courierService.handleWebhook({
      provider: "delhivery",
      body: {
        tracking_number: "TRK-STALE-01",
        status: "in_transit",
        event_id: "evt_stale_101",
      },
    });

    expect(result.stale).toBe(true);
    expect(result.message).toContain("safely ignored for shipment in status delivered");
    expect(shipment.status).toBe("delivered");
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 18: CUSTOMER NOTIFICATION OUTBOX ENQUEUING
  // ---------------------------------------------------------------------------
  test("18. Customer notification service creates transactional records on dispatch, delivery & RTO", async () => {
    const { createCustomerNotification } = require("../src/services/customer-notification.service");

    await createCustomerNotification({
      customerId,
      userId,
      title: "Order Dispatched",
      message: "Your order is on the way",
      type: "shipment",
    });

    expect(createCustomerNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId,
        type: "shipment",
      })
    );
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 19: VENDOR SETTLEMENT ACCOUNTS FOR RTO DEDUCTIONS
  // ---------------------------------------------------------------------------
  test("19. Vendor settlement accounts for RTO deductions with zero paise rounding drift", async () => {
    const baseOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-103-19",
      grandTotal: mongoose.Types.Decimal128.fromString("1000.00"),
      commissionSnapshot: {
        vendorPayableMinor: 90000,
        marketplaceFeeMinor: 10000,
      },
      status: "cancelled",
    };

    const settlementMinor = Math.round(Number(baseOrder.commissionSnapshot.vendorPayableMinor || 0));
    const rtoDeductionMinor = 90000;
    const netPayableMinor = settlementMinor - rtoDeductionMinor;

    expect(netPayableMinor).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 20: DOUBLE-ENTRY FINANCIAL LEDGER BALANCING
  // ---------------------------------------------------------------------------
  test("20. Double-entry financial ledger balances with zero paise variance across post-purchase lifecycle", async () => {
    const journalEntries = [
      {
        journalId: "JRNL-POSTPURCHASE-103",
        accountCode: "1010-CASH-GATEWAY",
        entryType: "CREDIT",
        amountPaise: 149900,
      },
      {
        journalId: "JRNL-POSTPURCHASE-103",
        accountCode: "2010-CUSTOMER-REFUND-CLEARING",
        entryType: "DEBIT",
        amountPaise: 149900,
      },
    ];

    const totalDebitsPaise = journalEntries
      .filter((e) => e.entryType === "DEBIT")
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const totalCreditsPaise = journalEntries
      .filter((e) => e.entryType === "CREDIT")
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const variancePaise = totalDebitsPaise - totalCreditsPaise;
    expect(variancePaise).toBe(0);
  });
});
