const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const digitalEntitlementService = require("../services/digital-entitlement.service");
const Customer = require("../models/Customer");
const AppError = require("../errors/AppError");
const logger = require("../config/logger");

/**
 * List the current customer's digital product entitlements
 */
const getMyEntitlements = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const customer = await Customer.findOne({ userId });
  const customerId = customer ? customer._id : userId;

  const result = await digitalEntitlementService.listCustomerEntitlements(
    customerId,
    req.query
  );

  return sendSuccess(res, {
    message: "Digital entitlements retrieved successfully",
    data: result,
  });
});

/**
 * Authorize and stream digital download
 */
const downloadFile = asyncHandler(async (req, res, next) => {
  const { entitlementId } = req.params;

  const { stream, size, mimeType, fileName } =
    await digitalEntitlementService.authorizeAndDeliverDownload(
      entitlementId,
      req.user,
      req
    );

  res.setHeader("Content-Type", mimeType || "application/octet-stream");
  if (size) {
    res.setHeader("Content-Length", size);
  }
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(fileName)}"`
  );
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("X-Content-Type-Options", "nosniff");

  stream.on("error", (streamErr) => {
    logger.error("Error streaming digital file download", {
      entitlementId,
      error: streamErr.message,
    });
    if (!res.headersSent) {
      return next(new AppError("Failed to deliver digital asset", 500, "STREAM_DELIVERY_ERROR"));
    }
  });

  return stream.pipe(res);
});

/**
 * Admin: List all entitlements across orders
 */
const adminListEntitlements = asyncHandler(async (req, res) => {
  const filter = {
    status: req.query.status,
    orderId: req.query.orderId,
    customerId: req.query.customerId,
    productId: req.query.productId,
  };

  const result = await digitalEntitlementService.adminListEntitlements(filter, {
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    message: "Admin digital entitlements retrieved successfully",
    data: result,
  });
});

/**
 * Admin: Manually revoke an entitlement
 */
const adminRevokeEntitlement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const result = await digitalEntitlementService.adminRevokeEntitlement(
    id,
    reason,
    req.user.id || req.user._id
  );

  return sendSuccess(res, {
    message: "Entitlement revoked successfully",
    data: { entitlement: result },
  });
});

/**
 * Admin: Reset/extend downloads or expiry for an entitlement
 */
const adminResetEntitlement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { addDownloads, extendDays } = req.body;

  const result = await digitalEntitlementService.adminResetEntitlement(
    id,
    { addDownloads: Number(addDownloads) || 0, extendDays: Number(extendDays) || 0 },
    req.user.id || req.user._id
  );

  return sendSuccess(res, {
    message: "Entitlement updated successfully",
    data: { entitlement: result },
  });
});

module.exports = {
  getMyEntitlements,
  downloadFile,
  adminListEntitlements,
  adminRevokeEntitlement,
  adminResetEntitlement,
};
