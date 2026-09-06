const mongoose = require("mongoose");

const supportTicketMessageRepository = require("../repositories/support-ticket-message.repository");
const supportTicketRepository = require("../repositories/support-ticket.repository");
const customerRepository = require("../repositories/customer.repository");
const AppError = require("../errors/AppError");

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

const getTicket = async (ticketId) => {
  validateObjectId(ticketId, "ticket ID");

  const ticket = await supportTicketRepository.findById(ticketId);

  if (!ticket) {
    throw new AppError(
      "Support ticket not found",
      404,
      "SUPPORT_TICKET_NOT_FOUND"
    );
  }

  return ticket;
};

const getActiveCustomer = async (userId) => {
  validateObjectId(userId, "user ID");

  const customer = await customerRepository.findByUserId(userId);

  if (!customer || !customer.isActive) {
    throw new AppError(
      "Active customer profile not found",
      404,
      "CUSTOMER_NOT_FOUND"
    );
  }

  return customer;
};

const createCustomerMessage = async ({
  ticketId,
  userId,
  message,
}) => {
  const ticket = await getTicket(ticketId);
  const customer = await getActiveCustomer(userId);

  if (ticket.customerId.toString() !== customer._id.toString()) {
    throw new AppError(
      "You are not allowed to reply to this ticket",
      403,
      "SUPPORT_TICKET_ACCESS_DENIED"
    );
  }

  if (ticket.status === "closed") {
    throw new AppError(
      "Closed tickets cannot receive new messages",
      409,
      "SUPPORT_TICKET_CLOSED"
    );
  }

  return supportTicketMessageRepository.create({
    ticketId: ticket._id,
    senderId: userId,
    message,
    messageType: "customer",
  });
};

const createAgentMessage = async ({
  ticketId,
  userId,
  message,
}) => {
  await getTicket(ticketId);

  return supportTicketMessageRepository.create({
    ticketId,
    senderId: userId,
    message,
    messageType: "agent",
  });
};

const createInternalNote = async ({
  ticketId,
  userId,
  message,
}) => {
  await getTicket(ticketId);

  return supportTicketMessageRepository.create({
    ticketId,
    senderId: userId,
    message,
    messageType: "internal_note",
  });
};

const getTicketMessages = async (ticketId) => {
  await getTicket(ticketId);

  return supportTicketMessageRepository.findByTicket(ticketId);
};

const getMyTicketMessages = async (ticketId, userId) => {
  const customer = await getActiveCustomer(userId);
  const ticket = await getTicket(ticketId);

  if (ticket.customerId.toString() !== customer._id.toString()) {
    throw new AppError(
      "You are not allowed to access this ticket",
      403,
      "SUPPORT_TICKET_ACCESS_DENIED"
    );
  }

  const messages = await supportTicketMessageRepository.findByTicket(
    ticketId
  );

  return messages.filter(
    (message) => message.messageType !== "internal_note"
  );
};

module.exports = {
  createCustomerMessage,
  createAgentMessage,
  createInternalNote,
  getTicketMessages,
  getMyTicketMessages,
};

