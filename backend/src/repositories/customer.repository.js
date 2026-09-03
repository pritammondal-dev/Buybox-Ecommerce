const Customer = require("../models/Customer");

const create = async (data) => {
  return Customer.create(data);
};

const findByUserId = async (userId) => {
  return Customer.findOne({
    userId,
    deletedAt: null,
  });
};

const findById = async (id) => {
  return Customer.findOne({
    _id: id,
    deletedAt: null,
  });
};

const updateByUserId = async (userId, data) => {
  return Customer.findOneAndUpdate(
    {
      userId,
      deletedAt: null,
    },
    data,
    {
      new: true,
      runValidators: true,
    }
  );
};

const softDeleteByUserId = async (userId) => {
  return Customer.findOneAndUpdate(
    {
      userId,
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
  findByUserId,
  findById,
  updateByUserId,
  softDeleteByUserId,
};