const Warehouse = require("../models/Warehouse");

const create = async (data) => {
  return Warehouse.create(data);
};

const findById = async (id) => {
  return Warehouse.findOne({
    _id: id,
    deletedAt: null,
  });
};

const findByCode = async (code) => {
  return Warehouse.findOne({
    code,
    deletedAt: null,
  });
};

const findAll = async (filter = {}) => {
  return Warehouse.find({
    deletedAt: null,
    ...filter,
  }).sort({
    createdAt: -1,
  });
};

const updateById = async (id, data) => {
  return Warehouse.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    data,
    {
      new: true,
      runValidators: true,
    }
  );
};

const softDeleteById = async (id) => {
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
    }
  );
};

module.exports = {
  create,
  findById,
  findByCode,
  findAll,
  updateById,
  softDeleteById,
};