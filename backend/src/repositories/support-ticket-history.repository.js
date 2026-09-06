const SupportTicketHistory = require("../models/SupportTicketHistory");

const create = (data, options = {}) =>
  SupportTicketHistory.create([data], options).then((docs) => docs[0]);

const findByTicket = (ticketId, options = {}) =>
  SupportTicketHistory.find({ ticketId })
    .sort({ createdAt: 1 })
    .session(options.session || null);

module.exports = {
  create,
  findByTicket,
};