jest.mock("../src/repositories/cart.repository");
jest.mock("../src/models/Cart");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/NotificationOutbox");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/services/notification.service");

const mongoose = require("mongoose");
const cartRepository = require("../src/repositories/cart.repository");
const Cart = require("../src/models/Cart");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const NotificationOutbox = require("../src/models/NotificationOutbox");
const notificationOutboxService = require("../src/services/notification-outbox.service");
const NotificationService = require("../src/services/notification.service");
const { processNotification } = require("../src/services/notification-outbox.worker");

const cartAbandonmentService = require("../src/services/cart-abandonment.service");
const cartService = require("../src/services/cart.service");
const { processCartAbandonmentBatch } = require("../src/workers/cart-abandonment.worker");

describe("Abandoned Cart Lifecycle V1", () => {
  const customerId = "64b0f0000000000000000001";
  const userId = "64b0f0000000000000000002";
  const cartId = "64b0f0000000000000000003";
  const variantId = "64b0f0000000000000000004";
  const productId = "64b0f0000000000000000005";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Detection & Abandonment Eligibility", () => {
    it("should mark eligible inactive active cart with items as abandoned and enqueue notification", async () => {
      const pastDate = new Date(Date.now() - 120 * 60 * 1000);
      const eligibleCart = {
        _id: cartId,
        customerId,
        status: "active",
        items: [{ productVariantId: variantId, quantity: 1, priceSnapshot: "100.00" }],
        lastActivityAt: pastDate,
        grandTotal: mongoose.Types.Decimal128.fromString("100.00"),
        currency: "INR",
      };

      cartRepository.findEligibleForAbandonment.mockResolvedValue([eligibleCart]);
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      User.findOne.mockResolvedValue({ _id: userId, email: "user@test.com", firstName: "Test", lastName: "User", isActive: true });
      cartRepository.markCartAbandoned.mockResolvedValue({ ...eligibleCart, status: "abandoned", abandonedAt: new Date() });
      NotificationOutbox.findOne.mockResolvedValue(null);
      notificationOutboxService.enqueue.mockResolvedValue({ _id: "outbox-1" });

      const result = await cartAbandonmentService.detectAndProcessAbandonedCarts({ inactivityMinutes: 60 });

      expect(result.abandoned).toBe(1);
      expect(cartRepository.markCartAbandoned).toHaveBeenCalledWith(cartId, pastDate);
      expect(notificationOutboxService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "abandoned_cart",
          recipient: "user@test.com",
          payload: expect.objectContaining({ cartId, customerName: "Test User" }),
        })
      );
    });

    it("should ignore carts belonging to inactive or deleted customers", async () => {
      const eligibleCart = {
        _id: cartId,
        customerId,
        status: "active",
        items: [{ productVariantId: variantId, quantity: 1 }],
        lastActivityAt: new Date(Date.now() - 120 * 60 * 1000),
      };

      cartRepository.findEligibleForAbandonment.mockResolvedValue([eligibleCart]);
      Customer.findOne.mockResolvedValue(null); // Inactive/deleted customer

      const result = await cartAbandonmentService.detectAndProcessAbandonedCarts();

      expect(result.abandoned).toBe(0);
      expect(cartRepository.markCartAbandoned).not.toHaveBeenCalled();
      expect(notificationOutboxService.enqueue).not.toHaveBeenCalled();
    });

    it("should ignore carts belonging to inactive user accounts", async () => {
      const eligibleCart = {
        _id: cartId,
        customerId,
        status: "active",
        items: [{ productVariantId: variantId, quantity: 1 }],
        lastActivityAt: new Date(Date.now() - 120 * 60 * 1000),
      };

      cartRepository.findEligibleForAbandonment.mockResolvedValue([eligibleCart]);
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      User.findOne.mockResolvedValue(null); // Inactive user

      const result = await cartAbandonmentService.detectAndProcessAbandonedCarts();

      expect(result.abandoned).toBe(0);
      expect(cartRepository.markCartAbandoned).not.toHaveBeenCalled();
    });

    it("should not enqueue duplicate notification if notification already exists for the cart", async () => {
      const pastDate = new Date(Date.now() - 120 * 60 * 1000);
      const eligibleCart = {
        _id: cartId,
        customerId,
        status: "active",
        items: [{ productVariantId: variantId, quantity: 1 }],
        lastActivityAt: pastDate,
        grandTotal: mongoose.Types.Decimal128.fromString("50.00"),
        currency: "INR",
      };

      cartRepository.findEligibleForAbandonment.mockResolvedValue([eligibleCart]);
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      User.findOne.mockResolvedValue({ _id: userId, email: "user@test.com", firstName: "Test", isActive: true });
      cartRepository.markCartAbandoned.mockResolvedValue({ ...eligibleCart, status: "abandoned" });
      NotificationOutbox.findOne.mockResolvedValue({ _id: "existing-notif" }); // Already notified!

      const result = await cartAbandonmentService.detectAndProcessAbandonedCarts();

      expect(result.abandoned).toBe(1);
      expect(notificationOutboxService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("2. Read-Only GET & Explicit Recovery", () => {
    it("GET /cart should return abandoned cart as-is WITHOUT silently recovering it", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      cartRepository.findActiveByCustomer.mockResolvedValue(null);
      const abandonedCart = {
        _id: cartId,
        customerId,
        status: "abandoned",
        items: [{ productVariantId: variantId, quantity: 2, priceSnapshot: "50.00" }],
        abandonedAt: new Date(),
      };
      cartRepository.findLatestAbandonedByCustomer.mockResolvedValue(abandonedCart);

      const cart = await cartService.getCart(userId);

      expect(cart.status).toBe("abandoned");
      expect(cartRepository.recoverAbandonedCart).not.toHaveBeenCalled();
      expect(cartRepository.create).not.toHaveBeenCalled();
    });

    it("explicit recoverCart should transition cart to active, refresh pricing and recalculate totals", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      cartRepository.findActiveByCustomer.mockResolvedValue(null);
      const abandonedCart = {
        _id: cartId,
        customerId,
        status: "abandoned",
        currency: "INR",
        items: [{ productVariantId: variantId, quantity: 2, priceSnapshot: "40.00" }],
        discountTotal: "0.00",
        taxTotal: "0.00",
        shippingTotal: "0.00",
      };
      cartRepository.findLatestAbandonedByCustomer.mockResolvedValue(abandonedCart);

      ProductVariant.findOne.mockResolvedValue({
        _id: variantId,
        productId,
        price: mongoose.Types.Decimal128.fromString("60.00"), // Price changed from 40 to 60
        currency: "INR",
        isActive: true,
        deletedAt: null,
      });

      Product.findOne.mockResolvedValue({
        _id: productId,
        status: "active",
        deletedAt: null,
      });

      cartRepository.recoverAbandonedCart.mockImplementation((id, data) => ({
        _id: id,
        status: "active",
        ...data,
      }));

      const recovered = await cartService.recoverCart(userId);

      expect(recovered.status).toBe("active");
      expect(cartRepository.recoverAbandonedCart).toHaveBeenCalledWith(
        cartId,
        expect.objectContaining({
          items: [
            expect.objectContaining({
              productVariantId: variantId,
              quantity: 2,
              priceSnapshot: expect.any(mongoose.Types.Decimal128),
            }),
          ],
          subtotal: mongoose.Types.Decimal128.fromString("120.00"), // 2 * 60.00
          grandTotal: mongoose.Types.Decimal128.fromString("120.00"),
        })
      );
    });

    it("recovery should filter out deleted or inactive products/variants safely", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      cartRepository.findActiveByCustomer.mockResolvedValue(null);
      const deadVariantId = "64b0f0000000000000000099";
      const abandonedCart = {
        _id: cartId,
        customerId,
        status: "abandoned",
        currency: "INR",
        items: [
          { productVariantId: variantId, quantity: 1, priceSnapshot: "50.00" },
          { productVariantId: deadVariantId, quantity: 1, priceSnapshot: "100.00" },
        ],
      };
      cartRepository.findLatestAbandonedByCustomer.mockResolvedValue(abandonedCart);

      // variantId is valid
      ProductVariant.findOne.mockImplementation(({ _id }) => {
        if (_id === variantId) {
          return {
            _id: variantId,
            productId,
            price: mongoose.Types.Decimal128.fromString("50.00"),
            isActive: true,
            deletedAt: null,
          };
        }
        return null; // deadVariant is inactive/deleted
      });

      Product.findOne.mockResolvedValue({
        _id: productId,
        status: "active",
        deletedAt: null,
      });

      cartRepository.recoverAbandonedCart.mockImplementation((id, data) => ({
        _id: id,
        status: "active",
        ...data,
      }));

      const recovered = await cartService.recoverCart(userId);

      expect(recovered.items.length).toBe(1);
      expect(recovered.items[0].productVariantId).toBe(variantId);
      expect(recovered.subtotal.toString()).toBe("50.00");
    });

    it("addItem should recover abandoned cart if no active cart exists, then add item", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      const newVariantId = "64b0f0000000000000000006";

      ProductVariant.findOne.mockImplementation(({ _id }) => ({
        _id,
        productId,
        price: mongoose.Types.Decimal128.fromString("25.00"),
        currency: "INR",
        isActive: true,
        deletedAt: null,
      }));

      Product.findOne.mockResolvedValue({
        _id: productId,
        status: "active",
        deletedAt: null,
      });

      // No active cart initially
      cartRepository.findActiveByCustomer.mockResolvedValue(null);

      const abandonedCart = {
        _id: cartId,
        customerId,
        status: "abandoned",
        currency: "INR",
        items: [{ productVariantId: variantId, quantity: 1, priceSnapshot: "25.00", currency: "INR" }],
        discountTotal: "0.00",
        taxTotal: "0.00",
        shippingTotal: "0.00",
      };

      cartRepository.findLatestAbandonedByCustomer.mockResolvedValue(abandonedCart);
      cartRepository.recoverAbandonedCart.mockResolvedValue({
        ...abandonedCart,
        status: "active",
      });
      cartRepository.updateById.mockImplementation((id, cart) => cart);

      const result = await cartService.addItem(userId, newVariantId, 1);

      expect(cartRepository.recoverAbandonedCart).toHaveBeenCalledWith(cartId, expect.anything());
      expect(cartRepository.updateById).toHaveBeenCalledWith(
        cartId,
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ productVariantId: newVariantId }),
          ]),
        })
      );
    });

    it("ownership isolation: recoverCart throws if no abandoned cart belongs to customer", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      cartRepository.findActiveByCustomer.mockResolvedValue(null);
      cartRepository.findLatestAbandonedByCustomer.mockResolvedValue(null);

      await expect(cartService.recoverCart(userId)).rejects.toThrow("No abandoned cart found to recover");
    });
  });

  describe("3. Notification Outbox Worker Revalidation", () => {
    it("should skip sending notification if cart was recovered before worker runs", async () => {
      const notification = {
        type: "abandoned_cart",
        channel: "email",
        recipient: "user@test.com",
        payload: { cartId, customerName: "Test User" },
      };

      Cart.findById.mockResolvedValue({
        _id: cartId,
        status: "active", // Customer recovered the cart!
        items: [{ productVariantId: variantId }],
      });

      const result = await processNotification(notification);

      expect(result).toEqual({
        skipped: true,
        reason: "CART_NO_LONGER_ABANDONED",
      });
      expect(NotificationService.prototype.sendAbandonedCartNotification).not.toHaveBeenCalled();
    });

    it("should skip sending notification if customer was deleted or inactivated", async () => {
      const notification = {
        type: "abandoned_cart",
        channel: "email",
        recipient: "user@test.com",
        payload: { cartId, customerName: "Test User" },
      };

      Cart.findById.mockResolvedValue({
        _id: cartId,
        status: "abandoned",
        customerId,
        items: [{ productVariantId: variantId }],
      });

      Customer.findOne.mockResolvedValue(null); // Customer deleted

      const result = await processNotification(notification);

      expect(result).toEqual({
        skipped: true,
        reason: "CUSTOMER_INACTIVE_OR_DELETED",
      });
      expect(NotificationService.prototype.sendAbandonedCartNotification).not.toHaveBeenCalled();
    });

    it("should send abandoned cart notification if cart is still abandoned and customer is active", async () => {
      const notification = {
        type: "abandoned_cart",
        channel: "email",
        recipient: "user@test.com",
        payload: { cartId, customerName: "Test User" },
      };

      Cart.findById.mockResolvedValue({
        _id: cartId,
        status: "abandoned",
        customerId,
        items: [{ productVariantId: variantId }],
      });

      Customer.findOne.mockResolvedValue({ _id: customerId, isActive: true, deletedAt: null });
      NotificationService.prototype.sendAbandonedCartNotification.mockResolvedValue({ success: true });

      const result = await processNotification(notification);

      expect(NotificationService.prototype.sendAbandonedCartNotification).toHaveBeenCalledWith(
        expect.objectContaining({ to: "user@test.com", cartId })
      );
    });
  });

  describe("4. Concurrency & Race Handling", () => {
    it("abandonment vs cart-update race: markCartAbandoned optimistic concurrency check aborts if cart was updated", async () => {
      const initialActivity = new Date(Date.now() - 120 * 60 * 1000);
      const eligibleCart = {
        _id: cartId,
        customerId,
        status: "active",
        items: [{ productVariantId: variantId, quantity: 1 }],
        lastActivityAt: initialActivity,
      };

      cartRepository.findEligibleForAbandonment.mockResolvedValue([eligibleCart]);
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      User.findOne.mockResolvedValue({ _id: userId, isActive: true });

      // User modified the cart simultaneously: findOneAndUpdate with lastActivityAt fails to match
      cartRepository.markCartAbandoned.mockResolvedValue(null);

      const result = await cartAbandonmentService.detectAndProcessAbandonedCarts();

      expect(result.abandoned).toBe(0);
      expect(notificationOutboxService.enqueue).not.toHaveBeenCalled();
    });

    it("abandoned-cart processing vs checkout race: if cart converted to order, abandonment is aborted", async () => {
      const initialActivity = new Date(Date.now() - 120 * 60 * 1000);
      const eligibleCart = {
        _id: cartId,
        customerId,
        status: "active",
        items: [{ productVariantId: variantId, quantity: 1 }],
        lastActivityAt: initialActivity,
      };

      cartRepository.findEligibleForAbandonment.mockResolvedValue([eligibleCart]);
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      User.findOne.mockResolvedValue({ _id: userId, isActive: true });

      // Checkout converted cart to "converted" concurrently
      cartRepository.markCartAbandoned.mockResolvedValue(null);

      const result = await cartAbandonmentService.detectAndProcessAbandonedCarts();

      expect(result.abandoned).toBe(0);
      expect(notificationOutboxService.enqueue).not.toHaveBeenCalled();
    });

    it("multiple abandoned carts for same customer: recoverCart returns existing active cart if one is already active", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId, isActive: true, deletedAt: null });
      const activeCart = { _id: "active-cart-1", status: "active", customerId };
      cartRepository.findActiveByCustomer.mockResolvedValue(activeCart);

      const result = await cartService.recoverCart(userId);

      expect(result._id).toBe("active-cart-1");
      expect(cartRepository.recoverAbandonedCart).not.toHaveBeenCalled();
    });

    it("worker reentrancy guard: concurrent execution returns ALREADY_PROCESSING", async () => {
      cartAbandonmentService.detectAndProcessAbandonedCarts = jest.fn(() => new Promise((resolve) => setTimeout(() => resolve({ abandoned: 1 }), 50)));

      const run1 = processCartAbandonmentBatch();
      const run2 = processCartAbandonmentBatch();

      const [res1, res2] = await Promise.all([run1, run2]);

      expect(res1.abandoned).toBe(1);
      expect(res2).toEqual({ skipped: true, reason: "ALREADY_PROCESSING" });
    });
  });
});
