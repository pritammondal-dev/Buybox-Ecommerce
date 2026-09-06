const express = require("express");

const supportTicketController = require("../controllers/support-ticket.controller");

const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createSupportTicketSchema,
  updateSupportTicketSchema,
  assignSupportTicketSchema,
  transitionSupportTicketSchema,
  supportTicketIdParamsSchema,
} = require("../validators/support/support-ticket.validator");

const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

// Customer
router.post(
  "/",
  validate(createSupportTicketSchema),
  supportTicketController.createTicket
);

router.get(
  "/my",
  supportTicketController.getMyTickets
);

router.get(
  "/my/:ticketId",
  validate(supportTicketIdParamsSchema, "params"),
  supportTicketController.getMyTicketById
);

router.get(
  "/my/:ticketId/history",
  validate(supportTicketIdParamsSchema, "params"),
  supportTicketController.getMyTicketHistory
);

// Support / Manager / Admin
router.get(
  "/",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_READ),
  supportTicketController.listTickets
);

router.get(
  "/:ticketId",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_READ),
  validate(supportTicketIdParamsSchema, "params"),
  supportTicketController.getTicketById
);

router.get(
  "/:ticketId/history",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_READ),
  validate(supportTicketIdParamsSchema, "params"),
  supportTicketController.getTicketHistory
);

router.patch(
  "/:ticketId",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validate(supportTicketIdParamsSchema, "params"),
  validate(updateSupportTicketSchema),
  supportTicketController.updateTicket
);

router.patch(
  "/:ticketId/assign",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validate(supportTicketIdParamsSchema, "params"),
  validate(assignSupportTicketSchema),
  supportTicketController.assignTicket
);

router.patch(
  "/:ticketId/status",
  requirePermissions(PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validate(supportTicketIdParamsSchema, "params"),
  validate(transitionSupportTicketSchema),
  supportTicketController.transitionTicketStatus
);

module.exports = router;