const StorefrontContentBlock = require("../models/StorefrontContentBlock");

const findById = (blockId, options = {}) =>
  StorefrontContentBlock.findById(blockId).session(
    options.session || null
  );

const findByKey = (key, options = {}) =>
  StorefrontContentBlock.findOne({ key }).session(
    options.session || null
  );

const findMany = (filter = {}, options = {}) =>
  StorefrontContentBlock.find(filter)
    .sort({ displayOrder: 1, createdAt: -1 })
    .session(options.session || null);

const findActive = (options = {}) =>
  StorefrontContentBlock.find({
    isActive: true,
  })
    .sort({ displayOrder: 1, createdAt: -1 })
    .session(options.session || null);

const create = (data, options = {}) =>
 StorefrontContentBlock.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (
  blockId,
  update,
  options = {}
) =>
  StorefrontContentBlock.findByIdAndUpdate(
    blockId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

const deleteById = (blockId, options = {}) =>
  StorefrontContentBlock.findByIdAndDelete(
    blockId,
    {
      session: options.session || null,
    }
  );

module.exports = {
  findById,
  findByKey,
  findMany,
  findActive,
  create,
  updateById,
  deleteById,
};