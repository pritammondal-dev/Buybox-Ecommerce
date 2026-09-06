const supportTicketMessageService = require("../services/support-ticket-message.service");
const { sendSuccess } = require("../utils/apiResponse");

const createCustomerMessage = async (req, res, next) => {
  try {
    const message = await supportTicketMessageService.createCustomerMessage({
      ticketId: req.params.ticketId,
      userId: req.user.id,
      message: req.body.message,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Support ticket message added successfully",
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

const createAgentMessage = async (req, res, next) => {
  try {
    const message = await supportTicketMessageService.createAgentMessage({
      ticketId: req.params.ticketId,
      userId: req.user.id,
      message: req.body.message,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Support response added successfully",
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

const createInternalNote = async (req, res, next) => {
  try {
    const message = await supportTicketMessageService.createInternalNote({
      ticketId: req.params.ticketId,
      userId: req.user.id,
      message: req.body.message,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Internal support note added successfully",
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

const getTicketMessages = async (req, res, next) => {
  try {
    const messages = await supportTicketMessageService.getTicketMessages(
      req.params.ticketId
    );

    return sendSuccess(res, {
      message: "Support ticket messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

const getMyTicketMessages = async (req, res, next) => {
  try {
    const messages = await supportTicketMessageService.getMyTicketMessages(
      req.params.ticketId,
      req.user.id
    );

    return sendSuccess(res, {
      message: "Support ticket messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomerMessage,
  createAgentMessage,
  createInternalNote,
  getTicketMessages,
  getMyTicketMessages,
};

