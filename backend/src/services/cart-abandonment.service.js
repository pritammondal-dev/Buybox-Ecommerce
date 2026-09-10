const Cart = require("../models/Cart");
const Customer = require("../models/Customer");
const User = require("../models/User");
const NotificationOutbox = require("../models/NotificationOutbox");
const cartRepository = require("../repositories/cart.repository");
const notificationOutboxService = require("./notification-outbox.service");
const env = require("../config/env");
const logger = require("../config/logger");

class CartAbandonmentService {
  /**
   * Detect and transition eligible inactive carts to abandoned status.
   * Enqueues an idempotent notification into NotificationOutbox.
   */
  async detectAndProcessAbandonedCarts(options = {}) {
    const inactivityMinutes =
      options.inactivityMinutes || env.CART_ABANDONMENT_INACTIVITY_MINUTES;
    const batchSize =
      options.batchSize || env.CART_ABANDONMENT_BATCH_SIZE;

    const cutoffDate = new Date(Date.now() - inactivityMinutes * 60 * 1000);

    const eligibleCarts = await cartRepository.findEligibleForAbandonment(
      cutoffDate,
      batchSize
    );

    let processedCount = 0;
    let abandonedCount = 0;

    for (const cart of eligibleCarts) {
      processedCount += 1;

      // 1. Verify customer profile is active and not soft-deleted
      const customer = await Customer.findOne({
        _id: cart.customerId,
        isActive: true,
        deletedAt: null,
      });

      if (!customer) {
        continue;
      }

      // 2. Verify associated user account is active
      const user = await User.findOne({
        _id: customer.userId,
        isActive: true,
      });

      if (!user) {
        continue;
      }

      // 3. Atomically transition to abandoned with optimistic concurrency check on lastActivityAt
      const updatedCart = await cartRepository.markCartAbandoned(
        cart._id,
        cart.lastActivityAt
      );

      if (!updatedCart) {
        // Cart was modified, checked out, or already processed concurrently
        continue;
      }

      abandonedCount += 1;

      // 4. Idempotently enqueue notification if not already enqueued for this cart
      try {
        const existingNotification = await NotificationOutbox.findOne({
          type: "abandoned_cart",
          "payload.cartId": updatedCart._id.toString(),
        });

        if (!existingNotification) {
          const customerName = [user.firstName, user.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();

          await notificationOutboxService.enqueue({
            type: "abandoned_cart",
            channel: "email",
            recipient: user.email,
            payload: {
              cartId: updatedCart._id.toString(),
              customerId: customer._id.toString(),
              customerName: customerName || "Customer",
              itemCount: updatedCart.items.length,
              grandTotal: updatedCart.grandTotal
                ? updatedCart.grandTotal.toString()
                : "0.00",
              currency: updatedCart.currency || "INR",
            },
          });
        }
      } catch (notifyErr) {
        logger.error(
          {
            error: notifyErr.message,
            cartId: updatedCart._id.toString(),
          },
          "Failed to enqueue abandoned cart notification"
        );
      }
    }

    return {
      scanned: eligibleCarts.length,
      processed: processedCount,
      abandoned: abandonedCount,
    };
  }
}

module.exports = new CartAbandonmentService();
