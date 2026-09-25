const express = require("express");
const courierWebhookController = require("../controllers/courier-webhook.controller");

const router = express.Router();

/**
 * Public Courier Webhook Listener
 * Endpoint: POST /api/v1/shipping/webhooks/:provider
 */
router.post("/:provider", courierWebhookController.handleWebhook);

module.exports = router;
