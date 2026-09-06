const VendorPayout = require("../models/VendorPayout");

const create = async (data, options = {}) => {
  const documents = await VendorPayout.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findById = async (id, options = {}) => {
  return VendorPayout.findById(id).session(options.session || null);
};

const findByPayoutNumber = async (payoutNumber, options = {}) => {
  return VendorPayout.findOne({ payoutNumber }).session(
    options.session || null
  );
};

const findBySettlementId = async (settlementId, options = {}) => {
  return VendorPayout.findOne({ settlementId }).session(
    options.session || null
  );
};

const findByIdempotencyKey = async (
  vendorId,
  idempotencyKey,
  options = {}
) => {
  return VendorPayout.findOne({
    vendorId,
    idempotencyKey,
  }).session(options.session || null);
};

const findByVendorId = async (vendorId, options = {}) => {
  return VendorPayout.find({ vendorId })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const updateById = async (id, data, options = {}) => {
  return VendorPayout.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    session: options.session,
  });
};

module.exports = {
  create,
  findById,
  findByPayoutNumber,
  findBySettlementId,
  findByIdempotencyKey,
  findByVendorId,
  updateById,
};