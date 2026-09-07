const StorefrontBanner = require("../models/StorefrontBanner");

const create = (data, options = {}) =>
  StorefrontBanner.create([data], options).then((docs) => docs[0]);

const findById = (bannerId, options = {}) =>
  StorefrontBanner.findById(bannerId).session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  StorefrontBanner.find(filter)
    .sort({ displayOrder: 1, createdAt: -1 })
    .session(options.session || null);

const updateById = (bannerId, update, options = {}) =>
  StorefrontBanner.findByIdAndUpdate(bannerId, update, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });

const deleteById = (bannerId, options = {}) =>
  StorefrontBanner.findByIdAndDelete(bannerId, {
    session: options.session || null,
  });

module.exports = {
  create,
  findById,
  findMany,
  updateById,
  deleteById,
};