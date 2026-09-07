const StorefrontPublication = require("../models/StorefrontPublication");

const findById = (publicationId, options = {}) =>
  StorefrontPublication.findById(publicationId).session(
    options.session || null
  );

const findByResource = (
  resourceType,
  resourceId,
  options = {}
) =>
  StorefrontPublication.findOne({
    resourceType,
    resourceId,
  }).session(options.session || null);

const findPublishedByResource = (
  resourceType,
  resourceId,
  options = {}
) =>
  StorefrontPublication.findOne({
    resourceType,
    resourceId,
    status: "published",
  }).session(options.session || null);

const findByPreviewToken = (
  previewToken,
  options = {}
) =>
  StorefrontPublication.findOne({
    previewToken,
  }).session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  StorefrontPublication.find(filter)
    .sort({ updatedAt: -1 })
    .session(options.session || null);

const create = (data, options = {}) =>
  StorefrontPublication.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (
  publicationId,
  update,
  options = {}
) =>
  StorefrontPublication.findByIdAndUpdate(
    publicationId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

const deleteById = (
  publicationId,
  options = {}
) =>
  StorefrontPublication.findByIdAndDelete(
    publicationId,
    {
      session: options.session || null,
    }
  );

module.exports = {
  findById,
  findByResource,
  findPublishedByResource,
  findByPreviewToken,
  findMany,
  create,
  updateById,
  deleteById,
};