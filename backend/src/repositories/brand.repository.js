const Brand = require("../models/Brand");

const create = async (data) => {
  return Brand.create(data);
};

const findById = async (id) => {
  return Brand.findOne({
    _id: id,
    deletedAt: null,
  });
};

const findBySlug = async (slug) => {
  return Brand.findOne({
    slug,
    deletedAt: null,
  });
};

const updateById = async (id, data) => {
  return Brand.findOneAndUpdate(
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
  return Brand.findOneAndUpdate(
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
    Brand.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit),

    Brand.countDocuments(query),
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