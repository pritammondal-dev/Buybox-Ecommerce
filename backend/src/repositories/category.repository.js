const Category = require("../models/Category");

const create = async (data) => {
  return Category.create(data);
};

const findById = async (id) => {
  return Category.findOne({
    _id: id,
    deletedAt: null,
  });
};

const findBySlug = async (slug) => {
  return Category.findOne({
    slug,
    deletedAt: null,
  });
};

const updateById = async (id, data) => {
  return Category.findOneAndUpdate(
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
  return Category.findOneAndUpdate(
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

const list = async ({
  filter = {},
  skip = 0,
  limit = 20,
  sort = { sortOrder: 1, name: 1 },
}) => {
  const query = {
    ...filter,
    deletedAt: null,
  };

  const [items, total] = await Promise.all([
    Category.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit),

    Category.countDocuments(query),
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
  updateById,
  softDeleteById,
  list,
};