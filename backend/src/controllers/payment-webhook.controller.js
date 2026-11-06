const paymentWebhookService = require("../services/payment-webhook.service");

const handleRazorpayWebhook = async (req, res) => {
  const signature = req.get("X-Razorpay-Signature");
  const eventId = req.get("X-Razorpay-Event-Id");

  await paymentWebhookService.handleRazorpayWebhook({
    rawBody: req.body,
    signature,
    eventId,
  });

  return res.status(200).json({
    success: true,
    message: "Webhook received successfully",
  });
};

const handlePayPalWebhook = async (req, res) => {
  await paymentWebhookService.handlePayPalWebhook({
    rawBody: req.body,
    headers: req.headers,
  });

  return res.status(200).json({
    success: true,
    message: "PayPal webhook received successfully",
  });
};

module.exports = {
  handleRazorpayWebhook,
  handlePayPalWebhook,
};