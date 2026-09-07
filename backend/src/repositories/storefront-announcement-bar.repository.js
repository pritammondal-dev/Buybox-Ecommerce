const StorefrontAnnouncementBar = require("../models/StorefrontAnnouncementBar");

const findById = (barId, options = {}) =>
  StorefrontAnnouncementBar.findById(barId).session(
    options.session || null
  );

const findMany = (filter = {}, options = {}) =>
  StorefrontAnnouncementBar.find(filter)
    .sort({ displayOrder: 1, createdAt: -1 })
    .session(options.session || null);

const findActive = (options = {}) =>
  StorefrontAnnouncementBar.find({
    isActive: true,
  })
    .sort({ displayOrder: 1, createdAt: -1 })
    .session(options.session || null);

const create = (data, options = {}) =>
  StorefrontAnnouncementBar.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (
  barId,
  update,
  options = {}
) =>
  StorefrontAnnouncementBar.findByIdAndUpdate(
    barId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

const deleteById = (barId, options = {}) =>
  StorefrontAnnouncementBar.findByIdAndDelete(
    barId,
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