const financialOverviewService = require("../services/financial-overview.service");
const financialExceptionService = require("../services/financial-exception.service");
const apiResponse = require("../utils/apiResponse");

const getOverview = async (req, res) => {
  const { startDate, endDate, currency } = req.query;

  const overview = await financialOverviewService.getFinancialOverview({
    startDate,
    endDate,
    currency,
    actorId: req.user?._id,
  });

  return apiResponse.sendSuccess(res, {
    message: "Superadmin financial overview retrieved successfully",
    data: overview,
  });
};

const getExceptions = async (req, res) => {
  const { currency } = req.query;

  const exceptions = await financialExceptionService.getLegacyExceptions({
    currency,
  });

  return apiResponse.sendSuccess(res, {
    message: "Legacy financial exceptions retrieved successfully",
    data: exceptions,
  });
};

const classifyException = async (req, res) => {
  const {
    ledgerEntryId,
    exceptionCategory,
    reason,
    evidenceReportReference,
    operationalScopeExclusion,
  } = req.body;

  const exception = await financialExceptionService.classifyLegacyException({
    ledgerEntryId,
    exceptionCategory,
    reason,
    evidenceReportReference,
    actorId: req.user?._id,
    operationalScopeExclusion,
  });

  return apiResponse.sendSuccess(res, {
    message: "Legacy financial exception classified successfully",
    data: exception,
  });
};

module.exports = {
  getOverview,
  getExceptions,
  classifyException,
};

