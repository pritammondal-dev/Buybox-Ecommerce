const StorefrontMedia = require("../models/StorefrontMedia");

const findById = (mediaId, options = {}) =>
  StorefrontMedia.findById(mediaId).session(
    options.session || null
  );

const findMany = (filter = {}, options = {}) =>
  StorefrontMedia.find(filter)
    .sort({ createdAt: -1 })
    .session(options.session || null);

const findActive = (options = {}) =>
  StorefrontMedia.find({
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .session(options.session || null);

const create = (data, options = {}) =>
  StorefrontMedia.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (
  mediaId,
  update,
  options = {}
) =>
  StorefrontMedia.findByIdAndUpdate(
    mediaId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

const deleteById = (mediaId, options = {}) =>
  StorefrontMedia.findByIdAndDelete(
    mediaId,
    {
      session: options.session || null,
    }
  );

module.exports = {
  findById,
  findMany,
  findActive,
  create,
  updateById,
  deleteById,
};