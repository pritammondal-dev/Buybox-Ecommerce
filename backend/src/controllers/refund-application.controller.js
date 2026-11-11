const refundApplicationService = require("../services/refund-application.service");
const apiResponse = require("../utils/apiResponse");

const submitRefundApplication = async (req, res) => {
  const application = await refundApplicationService.submitRefundApplication({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId,
    merchantRemarks: req.body.merchantRemarks,
    deductionExplanation: req.body.deductionExplanation,
    supportingDocuments: req.body.supportingDocuments,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Refund disbursement application submitted successfully for administrator review",
    data: application,
  });
};

const resubmitRefundApplication = async (req, res) => {
  const application = await refundApplicationService.resubmitRefundApplication({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId,
    resubmittedRemarks: req.body.merchantRemarks || req.body.resubmittedRemarks,
    deductionExplanation: req.body.deductionExplanation,
    supportingDocuments: req.body.supportingDocuments,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Refund disbursement application revised and resubmitted successfully",
    data: application,
  });
};

const getMyRefundApplication = async (req, res) => {
  const application = await refundApplicationService.getRefundApplicationByReturnId({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId,
    isAdmin: false,
  });

  return apiResponse.sendSuccess(res, {
    message: "Refund application retrieved successfully",
    data: application,
  });
};

const getAdminRefundApplications = async (req, res) => {
  const result = await refundApplicationService.getAdminRefundApplications({
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Refund applications queue retrieved successfully",
    data: {
      applications: result.items,
      kpis: result.kpis,
    },
    meta: result.meta,
  });
};

const getAdminRefundApplicationById = async (req, res) => {
  const application = await refundApplicationService.getAdminRefundApplicationById(req.params.id);

  return apiResponse.sendSuccess(res, {
    message: "Refund application retrieved successfully",
    data: application,
  });
};

const reviewRefundApplication = async (req, res) => {
  const application = await refundApplicationService.reviewRefundApplication({
    applicationId: req.params.id,
    userId: req.user.id || req.user._id,
    notes: req.body.notes,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Refund application marked under review",
    data: application,
  });
};

const approveRefundApplication = async (req, res) => {
  const application = await refundApplicationService.approveRefundApplication({
    applicationId: req.params.id,
    userId: req.user.id || req.user._id,
    notes: req.body.notes,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Refund application approved successfully",
    data: application,
  });
};

const rejectRefundApplication = async (req, res) => {
  const application = await refundApplicationService.rejectRefundApplication({
    applicationId: req.params.id,
    userId: req.user.id || req.user._id,
    reason: req.body.rejectionReason || req.body.reason,
    notes: req.body.notes,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Refund application rejected successfully",
    data: application,
  });
};

const requestRevision = async (req, res) => {
  const application = await refundApplicationService.requestRefundApplicationRevision({
    applicationId: req.params.id,
    userId: req.user.id || req.user._id,
    instructions: req.body.revisionInstructions || req.body.instructions,
    notes: req.body.notes,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Revision requested successfully from merchant",
    data: application,
  });
};

const disburseRefundApplication = async (req, res) => {
  const application = await refundApplicationService.disburseRefundApplication({
    applicationId: req.params.id,
    userId: req.user.id || req.user._id,
    notes: req.body?.notes || req.body?.remarks || null,
    bankReference: req.body?.bankReference || null,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Customer refund successfully disbursed via payment gateway",
    data: application,
  });
};

const retryRefundApplicationDisbursement = async (req, res) => {
  const application = await refundApplicationService.disburseRefundApplication({
    applicationId: req.params.id,
    userId: req.user.id || req.user._id,
    notes: req.body?.notes || req.body?.remarks || "Retry after payment gateway failure",
    bankReference: req.body?.bankReference || null,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Disbursement retry executed successfully via payment gateway",
    data: application,
  });
};

const reconcileRefundApplication = async (req, res) => {
  const application = await refundApplicationService.reconcileRefundApplicationDisbursement({
    applicationId: req.params.id,
    userId: req.user.id || req.user._id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Refund application reconciled against authoritative payment gateway state",
    data: application,
  });
};

module.exports = {
  submitRefundApplication,
  resubmitRefundApplication,
  getMyRefundApplication,
  getAdminRefundApplications,
  getAdminRefundApplicationById,
  reviewRefundApplication,
  approveRefundApplication,
  rejectRefundApplication,
  requestRevision,
  disburseRefundApplication,
  retryRefundApplicationDisbursement,
  reconcileRefundApplication,
};
