const SupportTicketMessage = require("../models/SupportTicketMessage");

const create = (data, options = {}) =>
  SupportTicketMessage.create([data], options).then((docs) => docs[0]);

const findById = (messageId, options = {}) =>
  SupportTicketMessage.findById(messageId).session(options.session || null);

const findByTicket = (ticketId, options = {}) =>
  SupportTicketMessage.find({ ticketId })
    .sort({ createdAt: 1 })
    .session(options.session || null);

const updateById = (messageId, update, options = {}) =>
  SupportTicketMessage.findByIdAndUpdate(messageId, update, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });

const deleteById = (messageId, options = {}) =>
  SupportTicketMessage.findByIdAndDelete(messageId, {
    session: options.session || null,
  });

module.exports = {
  create,
  findById,
  findByTicket,
  updateById,
  deleteById,
};