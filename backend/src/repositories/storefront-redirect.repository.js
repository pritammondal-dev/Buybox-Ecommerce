const StorefrontRedirect = require("../models/StorefrontRedirect");

const findById = (redirectId, options = {}) =>
  StorefrontRedirect.findById(redirectId).session(
    options.session || null
  );

const findBySourcePath = (sourcePath, options = {}) =>
  StorefrontRedirect.findOne({
    sourcePath,
  }).session(options.session || null);

const findActiveBySourcePath = (
  sourcePath,
  options = {}
) =>
  StorefrontRedirect.findOne({
    sourcePath,
    isActive: true,
  }).session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  StorefrontRedirect.find(filter)
    .sort({ createdAt: -1 })
    .session(options.session || null);

const create = (data, options = {}) =>
  StorefrontRedirect.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (
  redirectId,
  update,
  options = {}
) =>
  StorefrontRedirect.findByIdAndUpdate(
    redirectId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

const deleteById = (redirectId, options = {}) =>
  StorefrontRedirect.findByIdAndDelete(
    redirectId,
    {
      session: options.session || null,
    }
  );

module.exports = {
  findById,
  findBySourcePath,
  findActiveBySourcePath,
  findMany,
  create,
  updateById,
  deleteById,
};
