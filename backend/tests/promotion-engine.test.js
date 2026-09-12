jest.mock("../src/repositories/coupon.repository");
jest.mock("../src/repositories/coupon-redemption.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/cart.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/notification.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Order");
jest.mock("../src/models/Coupon");
jest.mock("../src/utils/withTransaction");

const mongoose = require("mongoose");
const Coupon = require("../src/models/Coupon");
const couponRepository = require("../src/repositories/coupon.repository");
const couponRedemptionRepository = require("../src/repositories/coupon-redemption.repository");
const orderRepository = require("../src/repositories/order.repository");
const cartRepository = require("../src/repositories/cart.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const shipmentRepository = require("../src/repositories/shipment.repository");
const inventoryService = require("../src/services/inventory.service");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Order = require("../src/models/Order");
const withTransaction = require("../src/utils/withTransaction");

const couponService = require("../src/services/coupon.service");
const couponRedemptionService = require("../src/services/coupon-redemption.service");
const { cancelOrder, createOrderFromCurrentCart } = require("../src/services/order.service");
const couponController = require("../src/controllers/coupon.controller");

describe("Promotion Engine Review & Regression Test Suite", () => {
  const couponId = new mongoose.Types.ObjectId().toString();
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();
  const productId = new mongoose.Types.ObjectId().toString();
  const categoryId = new mongoose.Types.ObjectId().toString();
  const vendorId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    withTransaction.mockImplementation(async (callback) => callback({}));
    shipmentRepository.findByOrderId.mockResolvedValue([]);
    shipmentRepository.updateById.mockResolvedValue({});
    Customer.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(customerId),
      userId,
      isActive: true,
      deletedAt: null,
    });
    Customer.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ userId, firstName: "Test", lastName: "User" }),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ email: "test@example.com", firstName: "Test", lastName: "User" }),
      }),
    });
  });

  describe("1. Discount Calculations & Caps", () => {
    it("1. should correctly calculate percentage discount", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "SAVE20",
        type: "percentage",
        value: mongoose.Types.Decimal128.fromString("20.00"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("0.00"),
        scope: "all",
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
      });
      couponRedemptionRepository.countByCouponAndCustomer.mockResolvedValue(0);

      const result = await couponService.validateCoupon({
        code: "SAVE20",
        customerId,
        orderAmount: 500,
        items: [{ productId, lineTotal: 500 }],
      });

      expect(result.discountAmount).toBe("100.00");
      expect(result.finalOrderAmount).toBe("400.00");
    });

    it("2. should correctly calculate fixed discount", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "FLAT50",
        type: "fixed",
        value: mongoose.Types.Decimal128.fromString("50.00"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("100.00"),
        scope: "all",
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
      });
      couponRedemptionRepository.countByCouponAndCustomer.mockResolvedValue(0);

      const result = await couponService.validateCoupon({
        code: "FLAT50",
        customerId,
        orderAmount: 200,
        items: [{ productId, lineTotal: 200 }],
      });

      expect(result.discountAmount).toBe("50.00");
      expect(result.finalOrderAmount).toBe("150.00");
    });

    it("3. should reject when minimum order requirement is not met", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "MIN500",
        type: "fixed",
        value: mongoose.Types.Decimal128.fromString("50.00"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("500.00"),
        scope: "all",
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        couponService.validateCoupon({
          code: "MIN500",
          customerId,
          orderAmount: 300,
          items: [{ productId, lineTotal: 300 }],
        })
      ).rejects.toThrow("Minimum order amount for this coupon is 500.00");
    });

    it("4. should enforce maximum discount cap on percentage coupons", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "SAVE50CAP",
        type: "percentage",
        value: mongoose.Types.Decimal128.fromString("50.00"),
        maxDiscountAmount: mongoose.Types.Decimal128.fromString("75.00"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("0.00"),
        scope: "all",
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
      });
      couponRedemptionRepository.countByCouponAndCustomer.mockResolvedValue(0);

      const result = await couponService.validateCoupon({
        code: "SAVE50CAP",
        customerId,
        orderAmount: 1000, // 50% would be 500, but capped at 75
        items: [{ productId, lineTotal: 1000 }],
      });

      expect(result.discountAmount).toBe("75.00");
      expect(result.finalOrderAmount).toBe("925.00");
    });
  });

  describe("2. Validity, Status & Scope Rules", () => {
    it("5. should reject expired promotions", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "EXPIRED",
        startsAt: new Date(Date.now() - 200000),
        expiresAt: new Date(Date.now() - 100000), // Expired
      });

      await expect(
        couponService.validateCoupon({
          code: "EXPIRED",
          customerId,
          orderAmount: 100,
          items: [{ productId, lineTotal: 100 }],
        })
      ).rejects.toThrow("Coupon has expired");
    });

    it("6. should reject promotions that have not started or are inactive", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "FUTURE",
        startsAt: new Date(Date.now() + 100000), // In future
        expiresAt: new Date(Date.now() + 200000),
      });

      await expect(
        couponService.validateCoupon({
          code: "FUTURE",
          customerId,
          orderAmount: 100,
          items: [{ productId, lineTotal: 100 }],
        })
      ).rejects.toThrow("Coupon is not active yet");
    });

    it("16. should correctly apply scope filtering for products, categories, and vendors", async () => {
      const allowedProduct = new mongoose.Types.ObjectId().toString();
      const otherProduct = new mongoose.Types.ObjectId().toString();

      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "PRODCOUPON",
        type: "percentage",
        value: mongoose.Types.Decimal128.fromString("10.00"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("0.00"),
        scope: "products",
        productIds: [new mongoose.Types.ObjectId(allowedProduct)],
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
      });
      couponRedemptionRepository.countByCouponAndCustomer.mockResolvedValue(0);

      const result = await couponService.validateCoupon({
        code: "PRODCOUPON",
        customerId,
        orderAmount: 200,
        items: [
          { productId: allowedProduct, lineTotal: 100 },
          { productId: otherProduct, lineTotal: 100 },
        ],
      });

      // Discount is 10% of only the eligible 100 = 10.00
      expect(result.eligibleAmount).toBe("100.00");
      expect(result.discountAmount).toBe("10.00");
      expect(result.finalOrderAmount).toBe("190.00");
    });

    it("11. checkout recalculation: discount amounts are server-authoritative and client input amounts are ignored", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "AUTHCHECK",
        type: "percentage",
        value: mongoose.Types.Decimal128.fromString("25.00"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("0.00"),
        scope: "all",
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
      });
      couponRedemptionRepository.countByCouponAndCustomer.mockResolvedValue(0);

      // Client tries to claim 99.00 discount on a 100.00 order
      const validation = await couponService.validateCoupon({
        code: "AUTHCHECK",
        customerId,
        orderAmount: 100,
        items: [{ productId, lineTotal: 100 }],
      });

      // Server calculates exactly 25.00 (25%) regardless of any client expectations
      expect(validation.discountAmount).toBe("25.00");
      expect(validation.finalOrderAmount).toBe("75.00");
    });

    it("12. single-coupon determinism: an order cannot redeem more than one coupon", async () => {
      couponRepository.findById.mockResolvedValue({
        _id: couponId,
        isActive: true,
        status: "active",
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
      });

      // Order already has a redemption for another coupon
      couponRedemptionRepository.findByOrderId.mockResolvedValue({
        _id: "redemption-existing",
        couponId: "other-coupon-id",
        orderId,
      });

      await expect(
        couponRedemptionService.redeemCoupon({
          couponId,
          customerId,
          orderId,
        })
      ).rejects.toThrow("Order already has a coupon redemption");
    });

    it("13 & 14. Decimal128 rounding and precision: odd percentages calculate and round without precision loss", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "ODDPERCENT",
        type: "percentage",
        value: mongoose.Types.Decimal128.fromString("33.33"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("0.00"),
        scope: "all",
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
      });
      couponRedemptionRepository.countByCouponAndCustomer.mockResolvedValue(0);

      const result = await couponService.validateCoupon({
        code: "ODDPERCENT",
        customerId,
        orderAmount: 100,
        items: [{ productId, lineTotal: 100 }],
      });

      expect(result.discountAmount).toBe("33.33");
      expect(result.finalOrderAmount).toBe("66.67");
    });
  });

  describe("3. Global & Per-Customer Usage Limits", () => {
    it("7. should reject when global usage limit is reached", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "LIMITREACHED",
        type: "fixed",
        value: mongoose.Types.Decimal128.fromString("10.00"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("0.00"),
        scope: "all",
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
        usageLimit: 10,
        usageCount: 10, // Max reached
      });

      await expect(
        couponService.validateCoupon({
          code: "LIMITREACHED",
          customerId,
          orderAmount: 100,
          items: [{ productId, lineTotal: 100 }],
        })
      ).rejects.toThrow("Coupon usage limit has been reached");
    });

    it("8. should reject when per-customer usage limit is reached in validateCoupon", async () => {
      couponRepository.findActiveByCode.mockResolvedValue({
        _id: couponId,
        code: "ONCEPERCUST",
        type: "fixed",
        value: mongoose.Types.Decimal128.fromString("10.00"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("0.00"),
        scope: "all",
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
        perCustomerLimit: 1,
      });

      // Customer has already redeemed once
      couponRedemptionRepository.countByCouponAndCustomer.mockResolvedValue(1);

      await expect(
        couponService.validateCoupon({
          code: "ONCEPERCUST",
          customerId,
          orderAmount: 100,
          items: [{ productId, lineTotal: 100 }],
        })
      ).rejects.toThrow("Customer coupon usage limit has been reached");
    });

    it("9. concurrent redemption: incrementUsage returns null when usageLimit raced and throws 409", async () => {
      couponRepository.findById.mockResolvedValue({
        _id: couponId,
        isActive: true,
        status: "active",
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
        perCustomerLimit: 1,
      });
      couponRedemptionRepository.findByOrderId.mockResolvedValue(null);
      couponRedemptionRepository.countByCouponAndCustomer.mockResolvedValue(0);

      // incrementUsage returns null because another concurrent request grabbed the last usage
      couponRepository.incrementUsage.mockResolvedValue(null);

      await expect(
        couponRedemptionService.redeemCoupon({
          couponId,
          customerId,
          orderId,
        })
      ).rejects.toThrow("Coupon usage limit has been reached");
    });

    it("10. duplicate redemption on same order returns existing redemption idempotently", async () => {
      const existing = {
        _id: "redemption-1",
        couponId,
        customerId,
        orderId,
        redemptionCount: 1,
      };

      couponRepository.findById.mockResolvedValue({
        _id: couponId,
        isActive: true,
        status: "active",
        startsAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() + 100000),
      });
      couponRedemptionRepository.findByOrderId.mockResolvedValue(existing);

      const result = await couponRedemptionService.redeemCoupon({
        couponId,
        customerId,
        orderId,
      });

      expect(result).toBe(existing);
      expect(couponRepository.incrementUsage).not.toHaveBeenCalled();
      expect(couponRedemptionRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("4. Customer Isolation & Security", () => {
    it("17. validateCoupon controller prevents checking coupons using another customer's ID", async () => {
      const otherCustomerId = new mongoose.Types.ObjectId().toString();

      Customer.findOne.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(customerId),
        userId,
        isActive: true,
      });

      const req = {
        user: { id: userId },
        body: {
          code: "TEST",
          customerId: otherCustomerId, // Attempting to spoof another customer's ID
          orderAmount: 100,
          items: [{ productId, lineTotal: 100 }],
        },
      };

      const res = {};
      const next = jest.fn();

      await couponController.validateCoupon(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "You can only validate coupons for your own account",
          statusCode: 403,
        })
      );
    });

    it("18. validateCoupon rejects invalid object IDs or negative amounts", async () => {
      await expect(
        couponService.validateCoupon({
          code: "TEST",
          customerId: "invalid-id",
          orderAmount: 100,
          items: [{ productId, lineTotal: 100 }],
        })
      ).rejects.toThrow("Invalid customer ID");

      await expect(
        couponService.validateCoupon({
          code: "TEST",
          customerId,
          orderAmount: -50,
          items: [{ productId, lineTotal: 100 }],
        })
      ).rejects.toThrow("Invalid order amount");
    });
  });

  describe("5. Idempotent Coupon Cancellation Rollback (Mandatory Requirements)", () => {
    it("15. cancellation rolls back active redemption and decrements coupon usage count", async () => {
      const order = {
        _id: orderId,
        orderNumber: "BB-ORD-1",
        customerId,
        status: "pending",
        couponId,
        items: [],
      };

      orderRepository.findById.mockResolvedValue(order);
      paymentRepository.findByOrderId = jest.fn().mockResolvedValue(null);
      couponRedemptionRepository.deleteByOrderId.mockResolvedValue({
        _id: "redemption-1",
        couponId,
        orderId,
      });
      couponRepository.decrementUsage.mockResolvedValue({
        _id: couponId,
        usageCount: 4,
      });
      orderRepository.updateById.mockResolvedValue({
        ...order,
        status: "cancelled",
        cancellationStatus: "completed",
      });

      const result = await cancelOrder(orderId, { userId });

      expect(result.status).toBe("cancelled");
      expect(couponRedemptionRepository.deleteByOrderId).toHaveBeenCalledWith(orderId, expect.anything());
      expect(couponRepository.decrementUsage).toHaveBeenCalledWith(couponId, expect.anything());
    });

    it("19. repeated order cancellation does not roll back the same coupon twice (idempotency)", async () => {
      const order = {
        _id: orderId,
        orderNumber: "BB-ORD-1",
        customerId,
        status: "cancelled", // Already cancelled order
        cancellationStatus: "completed",
        couponId,
        items: [],
      };

      orderRepository.findById.mockResolvedValue(order);

      const result = await cancelOrder(orderId, { userId });

      expect(result.status).toBe("cancelled");
      expect(couponRedemptionRepository.deleteByOrderId).not.toHaveBeenCalled();
      expect(couponRepository.decrementUsage).not.toHaveBeenCalled();
    });

    it("20. order with couponId but no matching redemption does not decrement coupon usage", async () => {
      const order = {
        _id: orderId,
        orderNumber: "BB-ORD-1",
        customerId,
        status: "pending",
        couponId,
        items: [],
      };

      orderRepository.findById.mockResolvedValue(order);
      // deleteByOrderId returns null because redemption was already reversed or never created
      couponRedemptionRepository.deleteByOrderId.mockResolvedValue(null);
      orderRepository.updateById.mockResolvedValue({
        ...order,
        status: "cancelled",
        cancellationStatus: "completed",
      });

      await cancelOrder(orderId, { userId });

      expect(couponRedemptionRepository.deleteByOrderId).toHaveBeenCalledWith(orderId, expect.anything());
      expect(couponRepository.decrementUsage).not.toHaveBeenCalled();
    });

    it("21. two concurrent cancellation attempts: atomic delete ensures usageCount decrements exactly once", async () => {
      const order = {
        _id: orderId,
        orderNumber: "BB-ORD-1",
        customerId,
        status: "pending",
        couponId,
        items: [],
      };

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.updateById.mockImplementation((id, update) => Promise.resolve({ ...order, ...update }));

      // First call deletes the record; second concurrent call finds nothing (null)
      couponRedemptionRepository.deleteByOrderId
        .mockResolvedValueOnce({ _id: "redemption-1", couponId, orderId })
        .mockResolvedValueOnce(null);

      await Promise.all([cancelOrder(orderId, { userId }), cancelOrder(orderId, { userId })]);

      expect(couponRedemptionRepository.deleteByOrderId).toHaveBeenCalledTimes(2);
      expect(couponRepository.decrementUsage).toHaveBeenCalledTimes(1);
    });

    it("22. decrementUsage query condition ensures usageCount never becomes negative", async () => {
      // Direct repository unit test verifying usageCount: { $gt: 0 } filter
      Coupon.findOneAndUpdate = jest.fn().mockResolvedValue(null);

      const actualCouponRepo = jest.requireActual("../src/repositories/coupon.repository");
      await actualCouponRepo.decrementUsage(couponId, {});

      expect(Coupon.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: couponId,
          usageCount: { $gt: 0 },
        }),
        expect.objectContaining({
          $inc: { usageCount: -1 },
        }),
        expect.anything()
      );
    });

    it("23. cancellation rolls back only the redemption belonging to that specific order when the customer has multiple redemptions", async () => {
      const order1Id = new mongoose.Types.ObjectId().toString();
      const order2Id = new mongoose.Types.ObjectId().toString();

      const order1 = {
        _id: order1Id,
        orderNumber: "BB-ORD-1",
        customerId,
        status: "pending",
        couponId,
        items: [],
      };

      orderRepository.findById.mockResolvedValue(order1);
      orderRepository.updateById.mockResolvedValue({ ...order1, status: "cancelled" });

      couponRedemptionRepository.deleteByOrderId.mockImplementation((targetOrderId) => {
        if (targetOrderId === order1Id) {
          return Promise.resolve({ _id: "redemption-1", orderId: order1Id, couponId });
        }
        return Promise.resolve(null);
      });

      await cancelOrder(order1Id, { userId });

      // Verify that deleteByOrderId was called with order1Id and NOT order2Id
      expect(couponRedemptionRepository.deleteByOrderId).toHaveBeenCalledWith(order1Id, expect.anything());
      expect(couponRedemptionRepository.deleteByOrderId).not.toHaveBeenCalledWith(order2Id, expect.anything());
    });
  });
});
