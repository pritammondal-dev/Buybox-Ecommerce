const StorefrontSettings = require("../models/StorefrontSettings");

const findActive = (options = {}) =>
  StorefrontSettings.findOne({
    isActive: true,
  }).session(options.session || null);

const findById = (settingsId, options = {}) =>
  StorefrontSettings.findById(settingsId).session(
    options.session || null
  );

const create = (data, options = {}) =>
  StorefrontSettings.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (settingsId, update, options = {}) =>
  StorefrontSettings.findByIdAndUpdate(
    settingsId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

module.exports = {
  findActive,
  findById,
  create,
  updateById,
};