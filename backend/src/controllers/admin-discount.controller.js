const discountManagementService = require("../services/discount-management.service");
const apiResponse = require("../utils/apiResponse");

const createDiscount = async (req, res, next) => {
  try {
    const promotion = await discountManagementService.createPromotion({
      data: req.body,
      actor: req.user,
      req,
    });

    return apiResponse.sendSuccess(res, {
      statusCode: 201,
      message: "Promotion created successfully",
      data: promotion,
    });
  } catch (error) {
    return next(error);
  }
};

const getDiscounts = async (req, res, next) => {
  try {
    const result = await discountManagementService.listPromotions(req.query);

    return apiResponse.sendSuccess(res, {
      message: "Promotions retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const getDiscountById = async (req, res, next) => {
  try {
    const promotion = await discountManagementService.getPromotionById(req.params.id);

    return apiResponse.sendSuccess(res, {
      message: "Promotion retrieved successfully",
      data: promotion,
    });
  } catch (error) {
    return next(error);
  }
};

const updateDiscount = async (req, res, next) => {
  try {
    const promotion = await discountManagementService.updatePromotion({
      id: req.params.id,
      data: req.body,
      actor: req.user,
      req,
    });

    return apiResponse.sendSuccess(res, {
      message: "Promotion updated successfully",
      data: promotion,
    });
  } catch (error) {
    return next(error);
  }
};

const activateDiscount = async (req, res, next) => {
  try {
    const promotion = await discountManagementService.transitionStatus({
      id: req.params.id,
      action: "activate",
      reason: req.body?.reason || null,
      actor: req.user,
      req,
    });

    return apiResponse.sendSuccess(res, {
      message: "Promotion activated successfully",
      data: promotion,
    });
  } catch (error) {
    return next(error);
  }
};

const pauseDiscount = async (req, res, next) => {
  try {
    const promotion = await discountManagementService.transitionStatus({
      id: req.params.id,
      action: "pause",
      reason: req.body?.reason || null,
      actor: req.user,
      req,
    });

    return apiResponse.sendSuccess(res, {
      message: "Promotion paused successfully",
      data: promotion,
    });
  } catch (error) {
    return next(error);
  }
};

const resumeDiscount = async (req, res, next) => {
  try {
    const promotion = await discountManagementService.transitionStatus({
      id: req.params.id,
      action: "resume",
      reason: req.body?.reason || null,
      actor: req.user,
      req,
    });

    return apiResponse.sendSuccess(res, {
      message: "Promotion resumed successfully",
      data: promotion,
    });
  } catch (error) {
    return next(error);
  }
};

const cancelDiscount = async (req, res, next) => {
  try {
    const promotion = await discountManagementService.transitionStatus({
      id: req.params.id,
      action: "cancel",
      reason: req.body?.reason || null,
      actor: req.user,
      req,
    });

    return apiResponse.sendSuccess(res, {
      message: "Promotion cancelled successfully",
      data: promotion,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteDiscount = async (req, res, next) => {
  try {
    const deleted = await discountManagementService.deletePromotion({
      id: req.params.id,
      actor: req.user,
      req,
    });

    return apiResponse.sendSuccess(res, {
      message: "Promotion deleted successfully",
      data: deleted,
    });
  } catch (error) {
    return next(error);
  }
};

const previewDiscount = async (req, res, next) => {
  try {
    const preview = await discountManagementService.previewPromotion({
      promotionId: req.body.promotionId || null,
      promotionData: req.body.promotionData || null,
      productIds: req.body.productIds || [],
      variantIds: req.body.variantIds || [],
      limit: req.body.limit || 10,
      overrideFloor: req.body.overrideFloor || false,
      overrideReason: req.body.overrideReason || null,
      actor: req.user,
      req,
    });

    return apiResponse.sendSuccess(res, {
      message: "Promotion preview generated successfully",
      data: preview,
    });
  } catch (error) {
    return next(error);
  }
};

const assignProducts = async (req, res, next) => {
  try {
    const promotion = await discountManagementService.assignTargets({
      id: req.params.id,
      action: req.body.action || "add",
      productIds: req.body.productIds || [],
      variantIds: req.body.variantIds || [],
      categoryIds: req.body.categoryIds || [],
      brandIds: req.body.brandIds || [],
      actor: req.user,
      req,
    });

    return apiResponse.sendSuccess(res, {
      message: "Promotion targets updated successfully",
      data: promotion,
    });
  } catch (error) {
    return next(error);
  }
};

const promotionLifecycleService = require("../services/promotion-lifecycle.service");

const reconcileDiscounts = async (req, res, next) => {
  try {
    const result = await promotionLifecycleService.reconcilePromotions({
      batchSize: req.body?.batchSize,
      workerId: `admin-${req.user?.id || req.user?._id || "manual"}`,
      req,
    });

    return apiResponse.sendSuccess(res, {
      message: "Promotions lifecycle reconciled successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createDiscount,
  getDiscounts,
  getDiscountById,
  updateDiscount,
  activateDiscount,
  pauseDiscount,
  resumeDiscount,
  cancelDiscount,
  deleteDiscount,
  previewDiscount,
  assignProducts,
  reconcileDiscounts,
};
