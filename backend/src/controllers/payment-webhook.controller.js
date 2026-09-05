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

module.exports = {
  handleRazorpayWebhook,
};