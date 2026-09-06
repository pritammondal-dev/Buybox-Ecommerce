const Campaign = require("../models/Campaign");

const create = (data, options = {}) =>
  Campaign.create([data], options).then((docs) => docs[0]);

const findById = (campaignId, options = {}) =>
  Campaign.findById(campaignId).session(options.session || null);

const findBySlug = (slug, options = {}) =>
  Campaign.findOne({ slug }).session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  Campaign.find(filter)
    .sort({ createdAt: -1 })
    .session(options.session || null);

const updateById = (campaignId, update, options = {}) =>
  Campaign.findByIdAndUpdate(campaignId, update, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });

const deleteById = (campaignId, options = {}) =>
  Campaign.findByIdAndDelete(campaignId, {
    session: options.session || null,
  });

module.exports = {
  create,
  findById,
  findBySlug,
  findMany,
  updateById,
  deleteById,
};