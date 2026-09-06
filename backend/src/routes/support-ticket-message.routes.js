const express = require("express");

const supportTicketMessageController = require("../controllers/support-ticket-message.controller");

const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createSupportTicketMessageSchema,
  supportTicketMessageIdParamsSchema,
} = require("../validators/support/support-ticket-message.validator");

const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

// Customer

router.post(
  "/:ticketId/messages",
  validate(supportTicketMessageIdParamsSchema, "params"),
  validate(createSupportTicketMessageSchema),
  supportTicketMessageController.createCustomerMessage
);

router.get(
  "/:ticketId/messages",
  validate(supportTicketMessageIdParamsSchema, "params"),
  supportTicketMessageController.getMyTicketMessages
);

// Support / Manager / Admin

router.get(
  "/:ticketId/messages/all",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_READ),
  validate(supportTicketMessageIdParamsSchema, "params"),
  supportTicketMessageController.getTicketMessages
);

router.post(
  "/:ticketId/messages/reply",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validate(supportTicketMessageIdParamsSchema, "params"),
  validate(createSupportTicketMessageSchema),
  supportTicketMessageController.createAgentMessage
);

router.post(
  "/:ticketId/messages/internal-note",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validate(supportTicketMessageIdParamsSchema, "params"),
  validate(createSupportTicketMessageSchema),
  supportTicketMessageController.createInternalNote
);

module.exports = router;
