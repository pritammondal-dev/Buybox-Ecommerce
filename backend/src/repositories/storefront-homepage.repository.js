const StorefrontHomepage = require("../models/StorefrontHomepage");

const findById = (homepageId, options = {}) =>
  StorefrontHomepage.findById(homepageId).session(
    options.session || null
  );

const findByKey = (key, options = {}) =>
  StorefrontHomepage.findOne({ key }).session(
    options.session || null
  );

const findActiveByKey = (key, options = {}) =>
  StorefrontHomepage.findOne({
    key,
    isActive: true,
  })
    .populate({
      path: "blocks.blockId",
      match: { isActive: true },
    })
    .session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  StorefrontHomepage.find(filter)
    .sort({ createdAt: -1 })
    .session(options.session || null);

const create = (data, options = {}) =>
  StorefrontHomepage.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (
  homepageId,
  update,
  options = {}
) =>
  StorefrontHomepage.findByIdAndUpdate(
    homepageId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

const deleteById = (homepageId, options = {}) =>
  StorefrontHomepage.findByIdAndDelete(
    homepageId,
    {
      session: options.session || null,
    }
  );

module.exports = {
  findById,
  findByKey,
  findActiveByKey,
  findMany,
  create,
  updateById,
  deleteById,
};