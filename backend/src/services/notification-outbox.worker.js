const NotificationOutbox = require("../models/NotificationOutbox");
const notificationService = require("./notification");

const processNotification = async (notification) => {
  const { type, channel, recipient, payload } = notification;

  if (channel !== "email") {
    throw new Error(
      `Unsupported notification channel: ${channel}`
    );
  }

  switch (type) {
    case "order_confirmation":
      return notificationService.sendOrderConfirmation({
        to: recipient,
        ...payload,
      });

    case "payment_confirmation":
      return notificationService.sendPaymentConfirmation({
        to: recipient,
        ...payload,
      });

    case "order_status":
      return notificationService.sendOrderStatusUpdate({
        to: recipient,
        ...payload,
      });

    case "order_cancellation":
      return notificationService.sendOrderCancellation({
        to: recipient,
        ...payload,
      });

    case "refund_confirmation":
      return notificationService.sendRefundConfirmation({
        to: recipient,
        ...payload,
      });

    case "email_verification":
      return notificationService.sendEmailVerification({
        to: recipient,
        ...payload,
      });

    case "password_reset":
      return notificationService.sendPasswordReset({
        to: recipient,
        ...payload,
      });

    default:
      throw new Error(
        `Unsupported notification type: ${type}`
      );
  }
};

const processNextNotification = async () => {
  const notification =
    await NotificationOutbox.findOneAndUpdate(
      {
        status: "pending",
        availableAt: {
          $lte: new Date(),
        },
      },
      {
        $set: {
          status: "processing",
        },
        $inc: {
          attempts: 1,
        },
      },
      {
        new: true,
        sort: {
          availableAt: 1,
          createdAt: 1,
        },
      }
    );

  if (!notification) {
    return null;
  }

  try {
    await processNotification(notification);

    notification.status = "sent";
    notification.processedAt = new Date();
    notification.lastError = null;

    await notification.save();

    return notification;
  } catch (error) {
    notification.status = "failed";
    notification.lastError = error.message;

    await notification.save();

    return notification;
  }
};

module.exports = {
  processNotification,
  processNextNotification,
};