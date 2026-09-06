const supportTicketService = require("../services/support-ticket.service");
const { sendSuccess } = require("../utils/apiResponse");

const createTicket = async (req, res, next) => {
  try {
    const ticket = await supportTicketService.createTicket({
      userId: req.user.id,
      ...req.body,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Support ticket created successfully",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

const getMyTickets = async (req, res, next) => {
  try {
    const tickets =
      await supportTicketService.getMyTickets(req.user.id);

    return sendSuccess(res, {
      message: "Support tickets fetched successfully",
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

const getMyTicketById = async (req, res, next) => {
  try {
    const ticket =
      await supportTicketService.getMyTicketById(
        req.params.ticketId,
        req.user.id
      );

    return sendSuccess(res, {
      message: "Support ticket fetched successfully",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

const getTicketById = async (req, res, next) => {
  try {
    const ticket =
      await supportTicketService.getTicketById(
        req.params.ticketId
      );

    return sendSuccess(res, {
      message: "Support ticket fetched successfully",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

const listTickets = async (req, res, next) => {
  try {
    const tickets =
      await supportTicketService.listTickets(req.query);

    return sendSuccess(res, {
      message: "Support tickets fetched successfully",
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

const updateTicket = async (req, res, next) => {
  try {
    const ticket =
      await supportTicketService.updateTicket(
        req.params.ticketId,
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      message: "Support ticket updated successfully",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

const assignTicket = async (req, res, next) => {
  try {
    const ticket =
      await supportTicketService.assignTicket(
        req.params.ticketId,
        req.body.assignedTo,
        req.user.id
      );

    return sendSuccess(res, {
      message: "Support ticket assigned successfully",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

const transitionTicketStatus = async (req, res, next) => {
  try {
    const ticket =
      await supportTicketService.transitionTicketStatus(
        req.params.ticketId,
        req.body.status,
        req.body.resolutionNote,
        req.user.id
      );

    return sendSuccess(res, {
      message: "Support ticket status updated successfully",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

const getTicketHistory = async (req, res, next) => {
  try {
    const history =
      await supportTicketService.getTicketHistory(
        req.params.ticketId
      );

    return sendSuccess(res, {
      message: "Support ticket history fetched successfully",
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

const getMyTicketHistory = async (req, res, next) => {
  try {
    const history =
      await supportTicketService.getMyTicketHistory(
        req.params.ticketId,
        req.user.id
      );

    return sendSuccess(res, {
      message: "Support ticket history fetched successfully",
      data: history,
    });
  } catch (error) {
    next(error);
  }
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

