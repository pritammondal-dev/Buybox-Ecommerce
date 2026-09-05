const paymentWebhookEventRepository = require("../repositories/payment-webhook-event.repository");
const AppError = require("../errors/AppError");
const env = require("../config/env");
const {
  verifyRazorpayWebhookSignature,
} = require("../utils/razorpayWebhook");

const {
  processPaymentWebhookEvent,
} = require("./payment-webhook-processor.service");

const handleRazorpayWebhook = async ({
  rawBody,
  signature,
  eventId,
}) => {
  if (!eventId || typeof eventId !== "string") {
    throw new AppError(
      "Razorpay webhook event ID is required",
      400,
      "WEBHOOK_EVENT_ID_REQUIRED"
    );
  }

  if (eventId.length > 200) {
    throw new AppError(
      "Invalid Razorpay webhook event ID",
      400,
      "INVALID_WEBHOOK_EVENT_ID"
    );
  }

  verifyRazorpayWebhookSignature(
    rawBody,
    signature,
    env.RAZORPAY_WEBHOOK_SECRET
  );

  let payload;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch (error) {
    throw new AppError(
      "Invalid Razorpay webhook payload",
      400,
      "INVALID_WEBHOOK_PAYLOAD"
    );
  }

  const eventType = payload?.event;

  if (!eventType || typeof eventType !== "string") {
    throw new AppError(
      "Razorpay webhook event type is required",
      400,
      "WEBHOOK_EVENT_TYPE_REQUIRED"
    );
  }

  const existingEvent =
    await paymentWebhookEventRepository.findByEventId(
      eventId
    );

  if (existingEvent) {
    return {
      duplicate: true,
      eventId,
      eventType: existingEvent.eventType,
      status: existingEvent.status,
    };
  }

  try {
    await paymentWebhookEventRepository.create({
      eventId,
      eventType,
      gateway: "razorpay",
      status: "received",
      payload,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateEvent =
        await paymentWebhookEventRepository.findByEventId(
          eventId
        );

      return {
        duplicate: true,
        eventId,
        eventType:
          duplicateEvent?.eventType || eventType,
        status:
          duplicateEvent?.status || "received",
      };
    }

    throw error;
  }

  const result =
    await processPaymentWebhookEvent(eventId);

  return {
    duplicate: false,
    ...result,
  };
};

module.exports = {
  handleRazorpayWebhook,
};