const Vendor = require("../models/Vendor");

const create = async (data) => {
  return Vendor.create(data);
};

const findByUserId = async (userId) => {
  return Vendor.findOne({
    userId,
    deletedAt: null,
  });
};

const findById = async (id) => {
  return Vendor.findOne({
    _id: id,
    deletedAt: null,
  });
};

const findBySlug = async (businessSlug) => {
  return Vendor.findOne({
    businessSlug,
    deletedAt: null,
  });
};

const updateByUserId = async (userId, data) => {
  return Vendor.findOneAndUpdate(
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

const updateById = async (id, data) => {
  return Vendor.findOneAndUpdate(
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

const findAll = async (filter = {}) => {
  return Vendor.find({
    deletedAt: null,
    ...filter,
  }).sort({
    createdAt: -1,
  });
};

const softDeleteById = async (id) => {
  return Vendor.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
      isActive: false,
      onboardingStatus: "inactive",
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
  findBySlug,
  updateByUserId,
  updateById,
  findAll,
  softDeleteById,
};