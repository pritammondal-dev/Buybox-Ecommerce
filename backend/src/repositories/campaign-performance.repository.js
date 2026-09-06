const CampaignPerformance = require("../models/CampaignPerformance");

const create = (data, options = {}) =>
  CampaignPerformance.create([data], options).then((docs) => docs[0]);

const findById = (performanceId, options = {}) =>
  CampaignPerformance.findById(performanceId).session(
    options.session || null
  );

const findByCampaignAndDate = (
  campaignId,
  date,
  options = {}
) =>
  CampaignPerformance.findOne({
    campaignId,
    date,
  }).session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  CampaignPerformance.find(filter)
    .sort({ date: -1 })
    .session(options.session || null);

const updateById = (performanceId, update, options = {}) =>
  CampaignPerformance.findByIdAndUpdate(performanceId, update, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });

const incrementMetrics = (
  performanceId,
  increments,
  options = {}
) =>
  CampaignPerformance.findByIdAndUpdate(
    performanceId,
    { $inc: increments },
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );

module.exports = {
  create,
  findById,
  findByCampaignAndDate,
  findMany,
  updateById,
  incrementMetrics,
};