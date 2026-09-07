const StorefrontSeo = require("../models/StorefrontSeo");

const findActive = (options = {}) =>
  StorefrontSeo.findOne({
    isActive: true,
  }).session(options.session || null);

const findById = (seoId, options = {}) =>
  StorefrontSeo.findById(seoId).session(
    options.session || null
  );

const create = (data, options = {}) =>
  StorefrontSeo.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (seoId, update, options = {}) =>
  StorefrontSeo.findByIdAndUpdate(
    seoId,
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

