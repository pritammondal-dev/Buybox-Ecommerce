const express = require("express");

const supportTicketMessageController = require("../controllers/support-ticket-message.controller");

const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { requireScope } = require("../middlewares/scope.middleware");
const { SCOPE_TYPES } = require("../constants/scope.constants");
const {
  resolveSupportTicketScope,
} = require("../services/scope-authorization.service");
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
  requireScope({
    scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
    resolveScopeId: async (req) => {
      const scope = await resolveSupportTicketScope(req.params.ticketId);
      return scope?.supportQueue;
    },
    allowGlobalPlatformActor: true,
  }),
  supportTicketMessageController.getTicketMessages
);

router.post(
  "/:ticketId/messages/reply",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validate(supportTicketMessageIdParamsSchema, "params"),
  validate(createSupportTicketMessageSchema),
  requireScope({
    scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
    resolveScopeId: async (req) => {
      const scope = await resolveSupportTicketScope(req.params.ticketId);
      return scope?.supportQueue;
    },
    allowGlobalPlatformActor: true,
  }),
  supportTicketMessageController.createAgentMessage
);

router.post(
  "/:ticketId/messages/internal-note",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validate(supportTicketMessageIdParamsSchema, "params"),
  validate(createSupportTicketMessageSchema),
  requireScope({
    scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
    resolveScopeId: async (req) => {
      const scope = await resolveSupportTicketScope(req.params.ticketId);
      return scope?.supportQueue;
    },
    allowGlobalPlatformActor: true,
  }),
  supportTicketMessageController.createInternalNote
);

module.exports = router;
