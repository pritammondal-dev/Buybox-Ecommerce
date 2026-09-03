const Product = require("../models/Product");

const create = async (data) => {
  return Product.create(data);
};

const findById = async (id, options = {}) => {
  const query = {
    _id: id,
    deletedAt: null,
  };

  if (options.publicOnly) {
    query.status = "active";
  }

  return Product.findOne(query);
};

const findBySlug = async (slug, options = {}) => {
  const query = {
    slug,
    deletedAt: null,
  };

  if (options.publicOnly) {
    query.status = "active";
  }

  return Product.findOne(query);
};

const findBySku = async (sku) => {
  return Product.findOne({
    sku,
    deletedAt: null,
  });
};

const updateById = async (id, data) => {
  return Product.findOneAndUpdate(
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
  return Product.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
      status: "archived",
    },
    {
      new: true,
    }
  );
};

const list = async ({
  filter = {},
  skip = 0,
  limit = 20,
  sort = { createdAt: -1 },
}) => {
  const query = {
    ...filter,
    deletedAt: null,
  };

  const [items, total] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit),

    Product.countDocuments(query),
  ]);

  return {
    items,
    total,
  };
};

module.exports = {
  create,
  findById,
  findBySlug,
  findBySku,
  updateById,
  softDeleteById,
  list,
};