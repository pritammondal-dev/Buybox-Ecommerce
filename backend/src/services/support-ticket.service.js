const mongoose = require("mongoose");
const User = require("../models/User");

const supportTicketRepository = require("../repositories/support-ticket.repository");
const customerRepository = require("../repositories/customer.repository");
const orderRepository = require("../repositories/order.repository");
const productRepository = require("../repositories/product.repository");
const supportTicketHistoryRepository = require("../repositories/support-ticket-history.repository");

const AppError = require("../errors/AppError");

const { ROLES } = require("../constants/auth.constants");

const {
  SUPPORT_TICKET_STATUS_TRANSITIONS,
} = require("../constants/support.constants");

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

const generateTicketNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();

  const random = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `TKT-${timestamp}-${random}`;
};

const recordHistory = async ({
  ticketId,
  actorId,
  action,
  fromValue = null,
  toValue = null,
  note = null,
  metadata = {},
}) => {
  return supportTicketHistoryRepository.create({
    ticketId,
    actorId,
    action,
    fromValue,
    toValue,
    note,
    metadata,
  });
};

const getActiveCustomer = async (userId) => {
  validateObjectId(userId, "user ID");

  const customer =
    await customerRepository.findByUserId(userId);

  if (!customer || !customer.isActive) {
    throw new AppError(
      "Active customer profile not found",
      404,
      "CUSTOMER_NOT_FOUND"
    );
  }

  return customer;
};

const getTicketForCustomer = async (
  ticketId,
  customerId
) => {
  validateObjectId(ticketId, "ticket ID");

  const ticket =
    await supportTicketRepository.findById(ticketId);

  if (!ticket) {
    throw new AppError(
      "Support ticket not found",
      404,
      "SUPPORT_TICKET_NOT_FOUND"
    );
  }

  if (
    ticket.customerId.toString() !==
    customerId.toString()
  ) {
    throw new AppError(
      "You are not allowed to access this ticket",
      403,
      "SUPPORT_TICKET_ACCESS_DENIED"
    );
  }

  return ticket;
};

const createTicket = async ({
  userId,
  subject,
  description,
  category = "other",
  priority = "medium",
  orderId = null,
  productId = null,
}) => {
  const customer =
    await getActiveCustomer(userId);

  if (orderId) {
    validateObjectId(orderId, "order ID");

    const order =
      await orderRepository.findById(orderId);

    if (!order) {
      throw new AppError(
        "Order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    if (
      order.customerId.toString() !==
      customer._id.toString()
    ) {
      throw new AppError(
        "You are not allowed to reference this order",
        403,
        "ORDER_ACCESS_DENIED"
      );
    }
  }

  if (productId) {
    validateObjectId(productId, "product ID");

    const product =
      await productRepository.findById(productId);

    if (!product || product.deletedAt) {
      throw new AppError(
        "Product not found",
        404,
        "PRODUCT_NOT_FOUND"
      );
    }
  }

  const ticket =
    await supportTicketRepository.create({
      ticketNumber: generateTicketNumber(),
      customerId: customer._id,
      subject,
      description,
      category,
      priority,
      orderId,
      productId,
      status: "open",
    });

  await recordHistory({
    ticketId: ticket._id,
    actorId: userId,
    action: "created",
    toValue: "open",
    note: "Support ticket created",
  });

  return ticket;
};

const getMyTickets = async (userId) => {
  const customer =
    await getActiveCustomer(userId);

  return supportTicketRepository.findByCustomer(
    customer._id
  );
};

const getMyTicketById = async (
  ticketId,
  userId
) => {
  const customer =
    await getActiveCustomer(userId);

  return getTicketForCustomer(
    ticketId,
    customer._id
  );
};

const getTicketById = async (ticketId) => {
  validateObjectId(ticketId, "ticket ID");

  const ticket =
    await supportTicketRepository.findById(ticketId);

  if (!ticket) {
    throw new AppError(
      "Support ticket not found",
      404,
      "SUPPORT_TICKET_NOT_FOUND"
    );
  }

  return ticket;
};

const listTickets = async (filter = {}) => {
  return supportTicketRepository.findMany(filter);
};

const updateTicket = async (
  ticketId,
  data,
  actorId
) => {
  validateObjectId(actorId, "actor ID");

  const ticket =
    await getTicketById(ticketId);

  const updatedTicket =
    await supportTicketRepository.updateById(
      ticketId,
      {
        ...(data.subject !== undefined && {
          subject: data.subject,
        }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.category !== undefined && {
          category: data.category,
        }),
        ...(data.priority !== undefined && {
          priority: data.priority,
        }),
      }
    );

  await recordHistory({
    ticketId: updatedTicket._id,
    actorId,
    action: "updated",
    note: "Support ticket details updated",
    metadata: {
      previousSubject: ticket.subject,
      previousCategory: ticket.category,
      previousPriority: ticket.priority,
    },
  });

  return updatedTicket;
};

const assignTicket = async (
  ticketId,
  assignedTo,
  actorId
) => {
  validateObjectId(
    assignedTo,
    "assigned user ID"
  );

  validateObjectId(
    actorId,
    "actor ID"
  );

  const ticket =
    await getTicketById(ticketId);

  const assignedUser = await User.findOne({
    _id: assignedTo,
    isActive: true,
    role: {
      $in: [
        ROLES.SUPPORT,
        ROLES.MANAGER,
        ROLES.ADMIN,
        ROLES.SUPER_ADMIN,
      ],
    },
  });

  if (!assignedUser) {
    throw new AppError(
      "Assigned user must be an active support-capable user",
      400,
      "INVALID_SUPPORT_ASSIGNEE"
    );
  }

  const previousAssignedTo =
    ticket.assignedTo
      ? ticket.assignedTo.toString()
      : null;

  const newAssignedTo =
    assignedUser._id.toString();

  if (previousAssignedTo === newAssignedTo) {
    return ticket;
  }

  const action = previousAssignedTo
    ? "reassigned"
    : "assigned";

  const updatedTicket =
    await supportTicketRepository.updateById(
      ticketId,
      {
        assignedTo: assignedUser._id,
      }
    );

  await recordHistory({
    ticketId: updatedTicket._id,
    actorId,
    action,
    fromValue: previousAssignedTo,
    toValue: newAssignedTo,
    note: previousAssignedTo
      ? "Support ticket reassigned"
      : "Support ticket assigned",
    metadata: {
      assignedUserId: newAssignedTo,
    },
  });

  return updatedTicket;
};

const transitionTicketStatus = async (
  ticketId,
  status,
  resolutionNote = null,
  actorId
) => {
  validateObjectId(actorId, "actor ID");

  const ticket =
    await getTicketById(ticketId);

  if (ticket.status === status) {
    return ticket;
  }

  const allowedTransitions =
    SUPPORT_TICKET_STATUS_TRANSITIONS[
      ticket.status
    ] || [];

  if (!allowedTransitions.includes(status)) {
    throw new AppError(
      `Cannot transition ticket from ${ticket.status} to ${status}`,
      409,
      "INVALID_SUPPORT_TICKET_TRANSITION"
    );
  }

  const previousStatus = ticket.status;

  const update = {
    status,
  };

  if (status === "resolved") {
    update.resolutionNote =
      resolutionNote?.trim() || null;

    update.resolvedAt = new Date();
  }

  if (status === "closed") {
    update.closedAt = new Date();

    if (resolutionNote !== null) {
      update.resolutionNote =
        resolutionNote?.trim() || null;
    }
  }

  if (status === "open") {
    update.resolvedAt = null;
    update.closedAt = null;
  }

  const updatedTicket =
    await supportTicketRepository.updateById(
      ticketId,
      update
    );

  await recordHistory({
    ticketId: updatedTicket._id,
    actorId,
    action: "status_changed",
    fromValue: previousStatus,
    toValue: status,
    note:
      resolutionNote?.trim() ||
      `Support ticket status changed from ${previousStatus} to ${status}`,
  });

  return updatedTicket;
};

const getTicketHistory = async (ticketId) => {
  await getTicketById(ticketId);

  return supportTicketHistoryRepository.findByTicket(
    ticketId
  );
};

const getMyTicketHistory = async (
  ticketId,
  userId
) => {
  const customer =
    await getActiveCustomer(userId);

  const ticket =
    await getTicketForCustomer(
      ticketId,
      customer._id
    );

  return supportTicketHistoryRepository.findByTicket(
    ticket._id
  );
};

module.exports = {
  createTicket,
  getMyTickets,
  getMyTicketById,
  getTicketById,
  getTicketHistory,
  getMyTicketHistory,
  listTickets,
  updateTicket,
  assignTicket,
  transitionTicketStatus,
};

