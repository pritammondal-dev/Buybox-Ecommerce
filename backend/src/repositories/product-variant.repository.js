const ProductVariant = require("../models/ProductVariant");

const create = async (data) => {
  return ProductVariant.create(data);
};

const findById = async (id) => {
  return ProductVariant.findOne({
    _id: id,
    deletedAt: null,
  });
};

const findBySku = async (sku) => {
  return ProductVariant.findOne({
    sku,
    deletedAt: null,
  });
};

const findByProductId = async (productId) => {
  return ProductVariant.find({
    productId,
    deletedAt: null,
  }).sort({
    createdAt: 1,
  });
};

const updateById = async (id, data) => {
  return ProductVariant.findOneAndUpdate(
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
  return ProductVariant.findOneAndUpdate(
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
  findBySku,
  findByProductId,
  updateById,
  softDeleteById,
};