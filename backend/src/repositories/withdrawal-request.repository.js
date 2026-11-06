const mongoose = require("mongoose");
const WithdrawalRequest = require("../models/WithdrawalRequest");

const create = async (data, { session } = {}) => {
  const [doc] = await WithdrawalRequest.create([data], { session });
  return doc;
};

const findById = async (id, { session } = {}) => {
  if (!mongoose.isValidObjectId(id)) return null;
  return WithdrawalRequest.findById(id).session(session || null);
};

const findByWithdrawalNumber = async (withdrawalNumber, { session } = {}) => {
  return WithdrawalRequest.findOne({ withdrawalNumber }).session(session || null);
};

const findByIdempotencyKey = async (vendorId, idempotencyKey, { session } = {}) => {
  return WithdrawalRequest.findOne({ vendorId, idempotencyKey }).session(session || null);
};

const findByVendorId = async (
  vendorId,
  { status = null, skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
  { session } = {}
) => {
  const query = { vendorId };
  if (status) {
    query.status = status;
  }

  return WithdrawalRequest.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .session(session || null);
};

const countByVendorId = async (vendorId, { status = null } = {}, { session } = {}) => {
  const query = { vendorId };
  if (status) {
    query.status = status;
  }
  return WithdrawalRequest.countDocuments(query).session(session || null);
};

const findPaged = async (
  { filter = {}, skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
  { session } = {}
) => {
  return WithdrawalRequest.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .session(session || null);
};

const countFiltered = async (filter = {}, { session } = {}) => {
  return WithdrawalRequest.countDocuments(filter).session(session || null);
};

const updateById = async (id, update, { session, new: returnNew = true } = {}) => {
  return WithdrawalRequest.findByIdAndUpdate(id, update, {
    session: session || null,
    returnDocument: returnNew ? "after" : "before",
    runValidators: true,
  });
};

module.exports = {
  create,
  findById,
  findByWithdrawalNumber,
  findByIdempotencyKey,
  findByVendorId,
  countByVendorId,
  findPaged,
  countFiltered,
  updateById,
};

