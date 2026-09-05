const crypto = require("crypto");

const AppError = require("../errors/AppError");

const verifyRazorpayWebhookSignature = (
  rawBody,
  signature,
  webhookSecret
) => {
  if (!Buffer.isBuffer(rawBody)) {
    throw new AppError(
      "Invalid webhook body",
      400,
      "INVALID_WEBHOOK_BODY"
    );
  }

  if (
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    throw new AppError(
      "Invalid Razorpay webhook signature",
      401,
      "INVALID_WEBHOOK_SIGNATURE"
    );
  }

  if (
    typeof webhookSecret !== "string" ||
    webhookSecret.length === 0
  ) {
    throw new AppError(
      "Razorpay webhook secret is not configured",
      500,
      "WEBHOOK_SECRET_NOT_CONFIGURED"
    );
  }

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        webhookSecret
      )
      .update(rawBody)
      .digest("hex");

  const providedBuffer =
    Buffer.from(signature, "hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "hex"
    );

  if (
    providedBuffer.length !==
    expectedBuffer.length
  ) {
    throw new AppError(
      "Invalid Razorpay webhook signature",
      401,
      "INVALID_WEBHOOK_SIGNATURE"
    );
  }

  if (
    !crypto.timingSafeEqual(
      providedBuffer,
      expectedBuffer
    )
  ) {
    throw new AppError(
      "Invalid Razorpay webhook signature",
      401,
      "INVALID_WEBHOOK_SIGNATURE"
    );
  }

  return true;
};

module.exports = {
  verifyRazorpayWebhookSignature,
};