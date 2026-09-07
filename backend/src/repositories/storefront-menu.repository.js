const StorefrontMenu = require("../models/StorefrontMenu");

const create = (data, options = {}) =>
  StorefrontMenu.create([data], options).then((docs) => docs[0]);

const findById = (menuId, options = {}) =>
  StorefrontMenu.findById(menuId).session(options.session || null);

const findByKey = (key, options = {}) =>
  StorefrontMenu.findOne({ key }).session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  StorefrontMenu.find(filter)
    .sort({ location: 1, displayOrder: 1, createdAt: -1 })
    .session(options.session || null);

const updateById = (menuId, update, options = {}) =>
  StorefrontMenu.findByIdAndUpdate(menuId, update, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });

const deleteById = (menuId, options = {}) =>
  StorefrontMenu.findByIdAndDelete(menuId, {
    session: options.session || null,
  });

module.exports = {
  create,
  findById,
  findByKey,
  findMany,
  updateById,
  deleteById,
};