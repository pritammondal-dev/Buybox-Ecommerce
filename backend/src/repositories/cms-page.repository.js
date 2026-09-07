const CmsPage = require("../models/CmsPage");

const create = (data, options = {}) =>
  CmsPage.create([data], options).then((docs) => docs[0]);

const findById = (pageId, options = {}) =>
  CmsPage.findById(pageId).session(options.session || null);

const findBySlug = (slug, options = {}) =>
  CmsPage.findOne({ slug }).session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  CmsPage.find(filter)
    .sort({ createdAt: -1 })
    .session(options.session || null);

const updateById = (pageId, update, options = {}) =>
  CmsPage.findByIdAndUpdate(pageId, update, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });

const deleteById = (pageId, options = {}) =>
  CmsPage.findByIdAndDelete(pageId, {
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