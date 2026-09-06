const { VendorSettlement } = require("../models/VendorSettlement");

const create = async (data, options = {}) => {
  const documents = await VendorSettlement.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findById = async (id, options = {}) => {
  return VendorSettlement.findById(id).session(options.session || null);
};

const findBySettlementNumber = async (settlementNumber, options = {}) => {
  return VendorSettlement.findOne({ settlementNumber }).session(
    options.session || null
  );
};

const findByIdempotencyKey = async (
  vendorId,
  idempotencyKey,
  options = {}
) => {
  return VendorSettlement.findOne({
    vendorId,
    idempotencyKey,
  }).session(options.session || null);
};

const findByVendorId = async (vendorId, options = {}) => {
  return VendorSettlement.find({
    vendorId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const findByPeriod = async (
  vendorId,
  periodStart,
  periodEnd,
  options = {}
) => {
  return VendorSettlement.findOne({
    vendorId,
    periodStart,
    periodEnd,
  }).session(options.session || null);
};

const updateById = async (id, data, options = {}) => {
  return VendorSettlement.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    session: options.session,
  });
};

module.exports = {
  create,
  findById,
  findBySettlementNumber,
  findByIdempotencyKey,
  findByVendorId,
  findByPeriod,
  updateById,
};