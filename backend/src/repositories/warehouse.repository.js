const Warehouse = require("../models/Warehouse");

const create = async (data, options = {}) => {
  return Warehouse.create([data], options).then((docs) => docs[0]);
};

const findById = async (id, options = {}) => {
  return Warehouse.findOne({
    _id: id,
    deletedAt: null,
  }).session(options.session || null);
};

const findByCode = async (code, options = {}) => {
  return Warehouse.findOne({
    code,
    deletedAt: null,
  }).session(options.session || null);
};

const findAll = async (filter = {}, options = {}) => {
  return Warehouse.find({
    deletedAt: null,
    ...filter,
  })
    .session(options.session || null)
    .sort({
      createdAt: -1,
    });
};

const findActive = async (filter = {}, options = {}) => {
  return Warehouse.find({
    deletedAt: null,
    isActive: true,
    ...filter,
  })
    .session(options.session || null)
    .sort({
      createdAt: -1,
    });
};

const updateById = async (id, data, options = {}) => {
  return Warehouse.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    data,
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const softDeleteById = async (id, options = {}) => {
  return Warehouse.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
      isActive: false,
    },
    {
      new: true,
      session: options.session,
    }
  );
};

module.exports = {
  create,
  findById,
  findByCode,
  findAll,
  findActive,
  updateById,
  softDeleteById,
};