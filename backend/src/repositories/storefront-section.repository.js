const StorefrontSection = require("../models/StorefrontSection");

const findById = (sectionId, options = {}) =>
  StorefrontSection.findById(sectionId).session(
    options.session || null
  );

const findByKey = (key, options = {}) =>
  StorefrontSection.findOne({ key }).session(
    options.session || null
  );

const findActiveByKey = (key, options = {}) =>
  StorefrontSection.findOne({
    key,
    isActive: true,
  })
    .populate("productIds")
    .session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  StorefrontSection.find(filter)
    .sort({ displayOrder: 1, createdAt: -1 })
    .populate("productIds")
    .session(options.session || null);

const findActive = (options = {}) =>
  StorefrontSection.find({
    isActive: true,
  })
    .sort({ displayOrder: 1, createdAt: -1 })
    .populate("productIds")
    .session(options.session || null);

const create = (data, options = {}) =>
  StorefrontSection.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (
  sectionId,
  update,
  options = {}
) =>
  StorefrontSection.findByIdAndUpdate(
    sectionId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

const deleteById = (sectionId, options = {}) =>
  StorefrontSection.findByIdAndDelete(
    sectionId,
    {
      session: options.session || null,
    }
  );

module.exports = {
  findById,
  findByKey,
  findActiveByKey,
  findMany,
  findActive,
  create,
  updateById,
  deleteById,
};