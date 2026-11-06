const SpecialEventPage = require("../models/SpecialEventPage");

const create = (data, options = {}) =>
  SpecialEventPage.create([data], options).then((docs) => docs[0]);

const findById = (id, options = {}) =>
  SpecialEventPage.findById(id).session(options.session || null);

const findBySlug = (slug, options = {}) =>
  SpecialEventPage.findOne({ slug: slug.toLowerCase() }).session(
    options.session || null
  );

const findByPreviewToken = (previewToken, options = {}) =>
  SpecialEventPage.findOne({ previewToken }).session(
    options.session || null
  );

const findMany = async (filter = {}, { page = 1, limit = 20, sort = { createdAt: -1 } } = {}, options = {}) => {
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    SpecialEventPage.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .session(options.session || null),
    SpecialEventPage.countDocuments(filter).session(options.session || null),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

const count = (filter = {}, options = {}) =>
  SpecialEventPage.countDocuments(filter).session(options.session || null);

const updateById = (id, update, options = {}) =>
  SpecialEventPage.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });

const deleteById = (id, options = {}) =>
  SpecialEventPage.findByIdAndDelete(id, {
    session: options.session || null,
  });

module.exports = {
  create,
  findById,
  findBySlug,
  findByPreviewToken,
  findMany,
  count,
  updateById,
  deleteById,
};
