const withdrawalRequestService = require("../services/withdrawal-request.service");
const apiResponse = require("../utils/apiResponse");
const AppError = require("../errors/AppError");

const submitWithdrawal = async (req, res) => {
  const vendorId = req.vendor._id;
  const actorId = req.user?.id || req.user?._id;
  const idempotencyKey =
    req.get("Idempotency-Key") ||
    req.get("idempotency-key") ||
    req.body.idempotencyKey;

  if (!idempotencyKey) {
    throw new AppError(
      "Idempotency-Key header is required for withdrawal requests",
      400,
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }

  const withdrawal = await withdrawalRequestService.requestWithdrawal({
    vendorId,
    amount: req.body.amount,
    bankAccountId: req.body.bankAccountId,
    notes: req.body.notes,
    idempotencyKey,
    actorId,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  const statusCode = withdrawal._isExisting ? 200 : 201;
  return apiResponse.sendSuccess(res, {
    statusCode,
    message: withdrawal._isExisting
      ? "Existing withdrawal request returned (idempotent)"
      : "Withdrawal request submitted successfully",
    data: withdrawal,
  });
};

const getMyWithdrawals = async (req, res) => {
  const vendorId = req.vendor._id;
  const result = await withdrawalRequestService.getVendorWithdrawals(
    vendorId,
    req.query
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor withdrawal requests retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getMyWithdrawalById = async (req, res) => {
  const vendorId = req.vendor._id;
  const withdrawal = await withdrawalRequestService.getVendorWithdrawalById(
    vendorId,
    req.params.id
  );

  return apiResponse.sendSuccess(res, {
    message: "Withdrawal request retrieved successfully",
    data: withdrawal,
  });
};

const getAdminWithdrawals = async (req, res) => {
  const result = await withdrawalRequestService.getAdminWithdrawals(req.query);

  return apiResponse.sendSuccess(res, {
    message: "Withdrawal requests retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getAdminWithdrawalById = async (req, res) => {
  const withdrawal = await withdrawalRequestService.getAdminWithdrawalById(
    req.params.id
  );

  return apiResponse.sendSuccess(res, {
    message: "Withdrawal request detail retrieved successfully",
    data: withdrawal,
  });
};

const approveWithdrawal = async (req, res) => {
  const actorId = req.user?.id || req.user?._id;

  const result = await withdrawalRequestService.approveWithdrawal({
    withdrawalId: req.params.id,
    actorId,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Withdrawal request approved successfully",
    data: result,
  });
};

const rejectWithdrawal = async (req, res) => {
  const actorId = req.user?.id || req.user?._id;

  const result = await withdrawalRequestService.rejectWithdrawal({
    withdrawalId: req.params.id,
    rejectionReason: req.body.rejectionReason,
    actorId,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Withdrawal request rejected and funds released successfully",
    data: result,
  });
};

const processWithdrawal = async (req, res) => {
  const actorId = req.user?.id || req.user?._id;

  const result = await withdrawalRequestService.processWithdrawalPayout({
    withdrawalId: req.params.id,
    actorId,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Withdrawal payout transfer initiated",
    data: result,
  });
};

const markWithdrawalPaid = async (req, res) => {
  const actorId = req.user?.id || req.user?._id;

  const result = await withdrawalRequestService.markWithdrawalPaid({
    withdrawalId: req.params.id,
    providerReference: req.body.providerReference,
    actorId,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Withdrawal payout completed successfully",
    data: result,
  });
};

const markWithdrawalFailed = async (req, res) => {
  const actorId = req.user?.id || req.user?._id;

  const result = await withdrawalRequestService.markWithdrawalFailed({
    withdrawalId: req.params.id,
    failureReason: req.body.failureReason,
    actorId,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Withdrawal payout marked failed and funds released",
    data: result,
  });
};

module.exports = {
  submitWithdrawal,
  getMyWithdrawals,
  getMyWithdrawalById,
  getAdminWithdrawals,
  getAdminWithdrawalById,
  approveWithdrawal,
  rejectWithdrawal,
  processWithdrawal,
  markWithdrawalPaid,
  markWithdrawalFailed,
};

