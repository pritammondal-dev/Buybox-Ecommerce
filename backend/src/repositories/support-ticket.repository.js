const SupportTicket = require("../models/SupportTicket");

const create = (data, options = {}) =>
  SupportTicket.create([data], options).then((docs) => docs[0]);

const findById = (ticketId, options = {}) =>
  SupportTicket.findById(ticketId).session(
    options.session || null
  );

const findByTicketNumber = (
  ticketNumber,
  options = {}
) =>
  SupportTicket.findOne({ ticketNumber }).session(
    options.session || null
  );

const findByCustomer = (
  customerId,
  options = {}
) =>
  SupportTicket.find({ customerId })
    .sort({ createdAt: -1 })
    .session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  SupportTicket.find(filter)
    .sort({ createdAt: -1 })
    .session(options.session || null);

const updateById = (
  ticketId,
  update,
  options = {}
) =>
  SupportTicket.findByIdAndUpdate(
    ticketId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

const deleteById = (
  ticketId,
  options = {}
) =>
  SupportTicket.findByIdAndDelete(ticketId, {
    session: options.session || null,
  });

module.exports = {
  create,
  findById,
  findByTicketNumber,
  findByCustomer,
  findMany,
  updateById,
  deleteById,
};