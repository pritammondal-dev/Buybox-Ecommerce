const PaymentWebhookEvent = require(
  "../models/PaymentWebhookEvent"
);

const create = async (
  data,
  options = {}
) => {
  const documents =
    await PaymentWebhookEvent.create(
      [data],
      {
        session: options.session,
      }
    );

  return documents[0];
};

const findByEventId = async (
  eventId,
  options = {}
) => {
  return PaymentWebhookEvent.findOne({
    eventId,
  }).session(
    options.session || null
  );
};

const updateByEventId = async (
  eventId,
  data,
  options = {}
) => {
  return PaymentWebhookEvent.findOneAndUpdate(
    { eventId },
    data,
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const markProcessing = async (
  eventId,
  options = {}
) => {
  return updateByEventId(
    eventId,
    {
      status: "processing",
      $inc: {
        attempts: 1,
      },
      lastAttemptAt: new Date(),
    },
    options
  );
};

const markProcessed = async (
  eventId,
  options = {}
) => {
  return updateByEventId(
    eventId,
    {
      status: "processed",
      processedAt: new Date(),
      errorMessage: null,
    },
    options
  );
};

const markFailed = async (
  eventId,
  errorMessage,
  options = {}
) => {
  return updateByEventId(
    eventId,
    {
      status: "failed",
      errorMessage:
        errorMessage || "Webhook processing failed",
    },
    options
  );
};

module.exports = {
  create,
  findByEventId,
  updateByEventId,
  markProcessing,
  markProcessed,
  markFailed,
};