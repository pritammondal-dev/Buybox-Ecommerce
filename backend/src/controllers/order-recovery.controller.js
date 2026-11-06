const orderRecoveryService = require("../services/order-recovery.service");
const { sendSuccess } = require("../utils/apiResponse");

const recoverOrderCancellation = async (req, res, next) => {
  try {
    const actor = {
      userId: req.user?._id || req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
    };
    const report = await orderRecoveryService.recoverIncompleteCancellation(
      req.params.id,
      actor
    );

    return sendSuccess(res, report, "Order cancellation recovery evaluated successfully");
  } catch (error) {
    return next(error);
  }
};

const reconcileRefund = async (req, res, next) => {
  try {
    const actor = {
      userId: req.user?._id || req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
    };
    const result = await orderRecoveryService.reconcilePendingRefund(
      req.params.id,
      actor
    );

    return sendSuccess(res, result, "Refund reconciliation completed");
  } catch (error) {
    return next(error);
  }
};

const reconcileOutbox = async (req, res, next) => {
  try {
    const result = await orderRecoveryService.reconcilePendingOutbox(req.body || {});
    return sendSuccess(res, result, "Outbox notification reconciliation completed");
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  recoverOrderCancellation,
  reconcileRefund,
  reconcileOutbox,
};
