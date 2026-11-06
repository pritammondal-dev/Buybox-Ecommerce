const ProductVariant = require("../models/ProductVariant");

const create = async (data, options = {}) => {
  if (options.session) {
    const docs = await ProductVariant.create(
      Array.isArray(data) ? data : [data],
      { session: options.session }
    );
    return Array.isArray(data) ? docs : docs[0];
  }
  return ProductVariant.create(data);
};

const findById = async (id, options = {}) => {
  let q = ProductVariant.findOne({
    _id: id,
    deletedAt: null,
  });
  if (options.session) {
    q = q.session(options.session);
  }
  return q;
};

const findBySku = async (sku, options = {}) => {
  let q = ProductVariant.findOne({
    sku,
    deletedAt: null,
  });
  if (options.session) {
    q = q.session(options.session);
  }
  return q;
};

const findByProductId = async (productId, options = {}) => {
  let q = ProductVariant.find({
    productId,
    deletedAt: null,
  }).sort({
    createdAt: 1,
  });
  if (options.session) {
    q = q.session(options.session);
  }
  return q;
};

const updateById = async (id, data, options = {}) => {
  return ProductVariant.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    data,
    {
      new: true,
      runValidators: true,
      ...(options.session ? { session: options.session } : {}),
    }
  );
};

const softDeleteById = async (id, options = {}) => {
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
      ...(options.session ? { session: options.session } : {}),
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