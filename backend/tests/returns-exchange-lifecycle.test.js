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
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Order");
jest.mock("../src/models/ReturnRequest");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/AuditLog");
jest.mock("../src/models/Refund");
jest.mock("../src/models/Inventory");
jest.mock("../src/services/notification");
jest.mock("../src/services/financial-ledger.service");

const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const Shipment = require("../src/models/Shipment");
const AuditLog = require("../src/models/AuditLog");
const Refund = require("../src/models/Refund");
const Inventory = require("../src/models/Inventory");
const inventoryService = require("../src/services/inventory.service");

const returnRequestService = require("../src/services/return-request.service");

function makeChainable(doc) {
  const chain = {
    populate: () => chain,
    select: () => chain,
    sort: () => chain,
    lean: () => Promise.resolve(doc),
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  };
  return chain;
}

describe("Returns & Exchange Full Lifecycle, Reverse Logistics & Flipkart SLA Acceptance", () => {
  const customerUserId = new mongoose.Types.ObjectId().toString();
  const customerId = new mongoose.Types.ObjectId().toString();

  const vendorAUserId = new mongoose.Types.ObjectId().toString();
  const vendorAId = new mongoose.Types.ObjectId().toString();
  const vendorBUserId = new mongoose.Types.ObjectId().toString();
  const vendorBId = new mongoose.Types.ObjectId().toString();

  const warehouseId = new mongoose.Types.ObjectId().toString();

  const prodAId = new mongoose.Types.ObjectId().toString();
  const prodBId = new mongoose.Types.ObjectId().toString();
  const digitalProdId = new mongoose.Types.ObjectId().toString();

  const variant1Id = new mongoose.Types.ObjectId().toString();
  const variant2Id = new mongoose.Types.ObjectId().toString();

  const orderId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();

    Customer.findOne.mockResolvedValue({
      _id: customerId,
      userId: customerUserId,
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul@example.com",
    });

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

    Warehouse.findOne.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ _id: warehouseId, code: "WH-NORTH", name: "North Hub", isActive: true }),
      }),
    });

    Product.findById.mockImplementation((id) => {
      const idStr = id?.toString();
      if (idStr === digitalProdId) {
        return {
          select: () => ({
            lean: () =>
              Promise.resolve({
                _id: digitalProdId,
                title: "Software License Key",
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
              _id: idStr || prodAId,
              title: "Noise-Cancelling Wireless Headphones",
              productType: "variant",
              isVirtual: false,
              isDownloadable: false,
            }),
        }),
      };
    });

    ProductVariant.find.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            { _id: variant1Id, name: "Midnight Black / M", sku: "HD-BLK-M", attributes: { color: "Black", size: "M" }, price: 2999 },
            { _id: variant2Id, name: "Polar White / L", sku: "HD-WHT-L", attributes: { color: "White", size: "L" }, price: 2999 },
          ]),
      }),
    });

    Product.find.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: prodAId, title: "Headphones" }]),
      }),
    });

    Inventory.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId().toString(),
      warehouseId,
      productId: prodAId,
      onHand: 10,
      reserved: 2,
    });
    Inventory.create.mockImplementation((data) =>
      Promise.resolve({ _id: new mongoose.Types.ObjectId().toString(), ...data })
    );

    Refund.find.mockReturnValue({ lean: () => Promise.resolve([]) });
    AuditLog.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId().toString() });
  });

  describe("1. Authoritative 7-Day Eligibility Check & Variant Sibling Resolution", () => {
    it("confirms eligibility for delivered physical items within the 7-day window", async () => {
      const deliveryTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

      Order.findById.mockImplementation(() =>
        makeChainable({
          _id: orderId,
          orderNumber: "ORD-BB-1001",
          customerId,
          status: "delivered",
          placedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          deliveredAt: deliveryTime,
          shippingAddress: { fullName: "Rahul Sharma", street: "123 Main St", city: "Bengaluru", postalCode: "560001" },
          items: [
            {
              _id: new mongoose.Types.ObjectId().toString(),
              productId: prodAId,
              productVariantId: variant1Id,
              productName: "Headphones Black M",
              quantity: 2,
              unitPrice: 2999,
              lineTotal: 5998,
              fulfillmentStatus: "delivered",
              deliveredAt: deliveryTime,
              vendorId: vendorAId,
            },
          ],
        })
      );

      Shipment.find.mockReturnValue({
        lean: () =>
          Promise.resolve([
            {
              shipmentNumber: "SHP-101",
              status: "delivered",
              deliveredAt: deliveryTime,
              items: [{ productId: prodAId, productVariantId: variant1Id, quantity: 2 }],
            },
          ]),
      });

      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      const result = await returnRequestService.checkOrderReturnEligibility({
        orderId,
        userId: customerUserId,
      });

      expect(result.isOrderEligible).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].isEligible).toBe(true);
      expect(result.items[0].remainingReturnableQuantity).toBe(2);
      expect(result.items[0].availableExchangeVariants).toHaveLength(1);
      expect(result.items[0].availableExchangeVariants[0].variantId.toString()).toBe(variant2Id);
    });

    it("rejects eligibility when the 7-day delivery policy window has expired", async () => {
      const deliveryTime = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000); // 9 days ago

      Order.findById.mockImplementation(() =>
        makeChainable({
          _id: orderId,
          orderNumber: "ORD-BB-1002",
          customerId,
          status: "delivered",
          deliveredAt: deliveryTime,
          items: [
            {
              _id: new mongoose.Types.ObjectId().toString(),
              productId: prodAId,
              productName: "Headphones Black M",
              quantity: 1,
              unitPrice: 2999,
              lineTotal: 2999,
              vendorId: vendorAId,
            },
          ],
        })
      );

      Shipment.find.mockReturnValue({ lean: () => Promise.resolve([]) });
      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      const result = await returnRequestService.checkOrderReturnEligibility({
        orderId,
        userId: customerUserId,
      });

      expect(result.isOrderEligible).toBe(false);
      expect(result.items[0].isEligible).toBe(false);
      expect(result.items[0].ineligibilityReason).toMatch(/expired/i);
    });

    it("marks digital and downloadable goods as strictly ineligible", async () => {
      const deliveryTime = new Date();

      Order.findById.mockImplementation(() =>
        makeChainable({
          _id: orderId,
          orderNumber: "ORD-BB-1003",
          customerId,
          status: "delivered",
          deliveredAt: deliveryTime,
          items: [
            {
              _id: new mongoose.Types.ObjectId().toString(),
              productId: digitalProdId,
              productName: "Software Key",
              quantity: 1,
              unitPrice: 999,
              lineTotal: 999,
              vendorId: vendorAId,
            },
          ],
        })
      );

      Shipment.find.mockReturnValue({ lean: () => Promise.resolve([]) });
      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      const result = await returnRequestService.checkOrderReturnEligibility({
        orderId,
        userId: customerUserId,
      });

      expect(result.isOrderEligible).toBe(false);
      expect(result.items[0].isEligible).toBe(false);
      expect(result.items[0].ineligibilityReason).toMatch(/digital/i);
    });
  });

  describe("2. Multi-Vendor Item Partitioning & Independent Partial Returns", () => {
    it("partitions a multi-vendor return into isolated vendor-scoped requests", async () => {
      const itemAId = new mongoose.Types.ObjectId().toString();
      const itemBId = new mongoose.Types.ObjectId().toString();
      const deliveryTime = new Date();

      const orderDoc = {
        _id: orderId,
        orderNumber: "ORD-BB-MULTI-101",
        customerId,
        status: "delivered",
        deliveredAt: deliveryTime,
        placedAt: new Date(),
        grandTotal: 5000,
        items: [
          {
            _id: itemAId,
            productId: prodAId,
            productName: "Vendor A Item",
            quantity: 1,
            unitPrice: 2000,
            lineTotal: 2000,
            vendorId: vendorAId,
          },
          {
            _id: itemBId,
            productId: prodBId,
            productName: "Vendor B Item",
            quantity: 1,
            unitPrice: 3000,
            lineTotal: 3000,
            vendorId: vendorBId,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockImplementation(() => makeChainable(orderDoc));
      Shipment.find.mockReturnValue({ lean: () => Promise.resolve([]) });
      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      const createdList = [];
      ReturnRequest.create.mockImplementation((doc) => {
        const item = { ...doc, _id: new mongoose.Types.ObjectId().toString() };
        createdList.push(item);
        return Promise.resolve(item);
      });

      const res = await returnRequestService.createReturnRequest({
        userId: customerUserId,
        orderId,
        items: [
          { orderItemId: itemAId, productId: prodAId, quantity: 1, reason: "defective" },
          { orderItemId: itemBId, productId: prodBId, quantity: 1, reason: "wrong_item" },
        ],
      });

      expect(createdList).toHaveLength(2);
      expect(createdList[0].vendorIds[0].toString()).toBe(vendorAId);
      expect(createdList[1].vendorIds[0].toString()).toBe(vendorBId);
      expect(res.returns).toHaveLength(2);
    });

    it("allows independent partial return without affecting non-returned items", async () => {
      const itemAId = new mongoose.Types.ObjectId().toString();
      const itemBId = new mongoose.Types.ObjectId().toString();
      const deliveryTime = new Date();

      const orderDoc = {
        _id: orderId,
        orderNumber: "ORD-BB-PARTIAL",
        customerId,
        status: "delivered",
        deliveredAt: deliveryTime,
        placedAt: new Date(),
        grandTotal: 4000,
        items: [
          {
            _id: itemAId,
            productId: prodAId,
            productName: "Returned Item",
            quantity: 2,
            returnedQuantity: 0,
            unitPrice: 1000,
            lineTotal: 2000,
            vendorId: vendorAId,
          },
          {
            _id: itemBId,
            productId: prodBId,
            productName: "Retained Item",
            quantity: 1,
            returnedQuantity: 0,
            unitPrice: 2000,
            lineTotal: 2000,
            vendorId: vendorAId,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockImplementation(() => makeChainable(orderDoc));
      Shipment.find.mockReturnValue({ lean: () => Promise.resolve([]) });
      ReturnRequest.find.mockReturnValue({ lean: () => Promise.resolve([]) });

      ReturnRequest.create.mockImplementation((doc) =>
        Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId().toString() })
      );

      await returnRequestService.createReturnRequest({
        userId: customerUserId,
        orderId,
        items: [{ orderItemId: itemAId, productId: prodAId, quantity: 1, reason: "defective" }],
      });

      // Item A has returnedQuantity updated to 1
      expect(orderDoc.items[0].returnedQuantity).toBe(1);
      expect(orderDoc.items[0].returnStatus).toBe("requested");
      // Item B remains completely untouched
      expect(orderDoc.items[1].returnedQuantity).toBe(0);
      expect(orderDoc.items[1].returnStatus).toBeUndefined();
    });
  });

  describe("3. Reverse Logistics & Doorstep Pickup Lifecycle", () => {
    it("schedules a reverse logistics pickup and generates tracking token", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      const returnDoc = {
        _id: returnDocId,
        returnNumber: "RET-SCHED-01",
        orderId,
        customerId,
        vendorIds: [new mongoose.Types.ObjectId(vendorAId)],
        type: "return",
        status: "approved",
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      ReturnRequest.findById.mockImplementation(() => makeChainable(returnDoc));

      const updated = await returnRequestService.scheduleReversePickup({
        returnId: returnDocId,
        userId: vendorAUserId,
        carrier: "DELHIVERY",
        scheduledDate: "2026-11-10",
        timeSlot: "10:00 AM - 01:00 PM",
        notes: "Pickup from customer apartment reception",
      });

      expect(updated.status).toBe("pickup_scheduled");
      expect(updated.reversePickupSchedule.carrier).toBe("DELHIVERY");
      expect(updated.reversePickupSchedule.pickupToken).toBeDefined();
      expect(updated.reversePickupSchedule.trackingNumber).toBeDefined();
      expect(returnDoc.save).toHaveBeenCalled();
    });

    it("confirms courier pickup handover and advances lifecycle to picked_up", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      const returnDoc = {
        _id: returnDocId,
        returnNumber: "RET-COLLECT-01",
        orderId,
        customerId,
        vendorIds: [new mongoose.Types.ObjectId(vendorAId)],
        type: "return",
        status: "pickup_scheduled",
        reversePickupSchedule: { status: "scheduled", carrier: "DELHIVERY" },
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      ReturnRequest.findById.mockImplementation(() => makeChainable(returnDoc));

      const updated = await returnRequestService.confirmReversePickup({
        returnId: returnDocId,
        userId: vendorAUserId,
        notes: "Package collected by Delhivery courier agent",
      });

      expect(updated.status).toBe("picked_up");
      expect(updated.reversePickupSchedule.status).toBe("completed");
      expect(updated.reversePickupSchedule.collectedAt).toBeDefined();
    });
  });

  describe("4. Technical Inspection & Sellable Stock Restocking", () => {
    it("restocks resellable units to warehouse sellable inventory when inspection passes", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      const returnDoc = {
        _id: returnDocId,
        returnNumber: "RET-INSPECT-PASS",
        orderId,
        customerId,
        vendorIds: [new mongoose.Types.ObjectId(vendorAId)],
        type: "return",
        status: "picked_up",
        items: [
          {
            productId: prodAId,
            productVariantId: variant1Id,
            quantity: 1,
            condition: "unopened",
          },
        ],
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      ReturnRequest.findById.mockImplementation(() => makeChainable(returnDoc));
      inventoryService.adjustStock.mockResolvedValue({ success: true });

      const updated = await returnRequestService.inspectReturnRequest({
        returnId: returnDocId,
        userId: vendorAUserId,
        outcome: "passed",
        condition: "unopened",
        restock: true,
        warehouseId,
        notes: "Factory seal intact, perfect condition",
      });

      expect(updated.status).toBe("inspected");
      expect(updated.inspection.outcome).toBe("passed");
      expect(updated.inspection.restocked).toBe(true);
      expect(inventoryService.adjustStock).toHaveBeenCalledWith(
        expect.any(String),
        1,
        expect.objectContaining({
          referenceType: "return",
        })
      );
    });

    it("quarantines damaged items without incrementing sellable stock when inspection fails", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      const returnDoc = {
        _id: returnDocId,
        returnNumber: "RET-INSPECT-FAIL",
        orderId,
        customerId,
        vendorIds: [new mongoose.Types.ObjectId(vendorAId)],
        type: "return",
        status: "picked_up",
        items: [
          {
            productId: prodAId,
            quantity: 1,
            condition: "damaged",
          },
        ],
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      ReturnRequest.findById.mockImplementation(() => makeChainable(returnDoc));
      inventoryService.adjustStock.mockResolvedValue({ success: true });

      const updated = await returnRequestService.inspectReturnRequest({
        returnId: returnDocId,
        userId: vendorAUserId,
        outcome: "failed",
        condition: "damaged",
        restock: false,
        notes: "Product casing cracked and headphone cable frayed",
      });

      expect(updated.status).toBe("inspected");
      expect(updated.inspection.outcome).toBe("failed");
      expect(updated.inspection.restocked).toBe(false);
      // adjustStock MUST NOT be called for quarantine/damaged stock
      expect(inventoryService.adjustStock).not.toHaveBeenCalled();
    });
  });

  describe("5. Exchange Fulfillment & Replacement Shipment", () => {
    it("reserves stock and dispatches replacement unit with tracking", async () => {
      const returnDocId = new mongoose.Types.ObjectId().toString();
      const returnDoc = {
        _id: returnDocId,
        returnNumber: "RET-EXCHANGE-FULFILL",
        orderId,
        customerId,
        vendorIds: [new mongoose.Types.ObjectId(vendorAId)],
        type: "exchange",
        status: "inspected",
        replacementVariantId: variant2Id,
        items: [{ productId: prodAId, quantity: 1, name: "Headphones Black" }],
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      ReturnRequest.findById.mockImplementation(() => makeChainable(returnDoc));
      Order.findById.mockImplementation(() =>
        makeChainable({
          _id: orderId,
          orderNumber: "ORD-BB-EX-101",
          items: [{ _id: new mongoose.Types.ObjectId().toString(), productId: prodAId, returnStatus: "approved" }],
          save: jest.fn().mockResolvedValue(true),
        })
      );
      ProductVariant.findById.mockReturnValue({
        lean: () => Promise.resolve({ _id: variant2Id, productId: prodAId, name: "White L", sku: "HD-WHT-L" }),
      });
      inventoryService.adjustStock.mockResolvedValue({ success: true });

      const updated = await returnRequestService.fulfillExchangeRequest({
        returnId: returnDocId,
        userId: vendorAUserId,
        carrier: "DELHIVERY",
        trackingNumber: "DEL-EX-889922",
        expectedDeliveryDays: 3,
        notes: "Replacement Polar White unit dispatched via priority air",
      });

      expect(updated.status).toBe("exchange_completed");
      expect(updated.replacementOrder.carrier).toBe("DELHIVERY");
      expect(updated.replacementOrder.trackingNumber).toBe("DEL-EX-889922");
      expect(inventoryService.reserveStock).toHaveBeenCalledWith(
        expect.any(String),
        1,
        expect.objectContaining({
          referenceType: "exchange",
        })
      );
    });
  });
});
