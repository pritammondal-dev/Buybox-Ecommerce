const PaymentMethod = require("../models/PaymentMethod");

const findActive = async (filter = {}, options = {}) => {
  return PaymentMethod.find({
    ...filter,
    enabled: true,
    isDeleted: false,
  })
    .sort({ displayOrder: 1, createdAt: 1 })
    .session(options.session || null);
};

const findAll = async (filter = {}, options = {}) => {
  const query = { isDeleted: false, ...filter };
  return PaymentMethod.find(query)
    .sort({ displayOrder: 1, createdAt: 1 })
    .session(options.session || null);
};

const findById = async (id, options = {}) => {
  return PaymentMethod.findById(id).session(options.session || null);
};

const findByCode = async (code, options = {}) => {
  return PaymentMethod.findOne({
    code: String(code || "").toLowerCase().trim(),
    isDeleted: false,
  }).session(options.session || null);
};

const create = async (data, options = {}) => {
  const [method] = await PaymentMethod.create([data], {
    session: options.session || null,
  });
  return method;
};

const updateById = async (id, data, options = {}) => {
  return PaymentMethod.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });
};

const softDelete = async (id, options = {}) => {
  return PaymentMethod.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
      deletedAt: new Date(),
      enabled: false,
    },
    {
      new: true,
      session: options.session || null,
    }
  );
};

const count = async (filter = {}, options = {}) => {
  return PaymentMethod.countDocuments({
    isDeleted: false,
    ...filter,
  }).session(options.session || null);
};

module.exports = {
  findActive,
  findAll,
  findById,
  findByCode,
  create,
  updateById,
  softDelete,
  count,
};
