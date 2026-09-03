const Address = require("../models/Address");

const create = async (data) => {
  return Address.create(data);
};

const findById = async (id, userId) => {
  return Address.findOne({
    _id: id,
    userId,
    deletedAt: null,
  });
};

const findByUserId = async (userId) => {
  return Address.find({
    userId,
    deletedAt: null,
  }).sort({
    isDefault: -1,
    createdAt: -1,
  });
};

const updateById = async (id, userId, data) => {
  return Address.findOneAndUpdate(
    {
      _id: id,
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

const softDeleteById = async (id, userId) => {
  return Address.findOneAndUpdate(
    {
      _id: id,
      userId,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
      isDefault: false,
    },
    {
      new: true,
    }
  );
};

const clearDefaultForUser = async (userId) => {
  return Address.updateMany(
    {
      userId,
      deletedAt: null,
      isDefault: true,
    },
    {
      $set: {
        isDefault: false,
      },
    }
  );
};

module.exports = {
  create,
  findById,
  findByUserId,
  updateById,
  softDeleteById,
  clearDefaultForUser,
};