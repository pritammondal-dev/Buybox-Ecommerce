const mongoose = require("mongoose");
const DigitalEntitlement = require("../models/DigitalEntitlement");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const digitalStorageService = require("./digital-storage.service");
const AppError = require("../errors/AppError");
const logger = require("../config/logger");

/**
 * Idempotently creates digital download entitlements for an order once payment is captured.
 *
 * @param {Object} order - The order document
 * @param {Object} options - { session }
 */
const createEntitlementsForOrder = async (order, options = {}) => {
  if (!order || !order.items || order.items.length === 0) {
    return [];
  }

  if (mongoose.connection.readyState === 0) {
    return [];
  }

  const createdEntitlements = [];
  const session = options.session || null;

  for (const item of order.items) {
    // Check if the item or its product/variant is downloadable
    const productId = item.productId;
    const variantId = item.productVariantId || null;

    let downloadableFiles = [];
    let downloadLimit = null;
    let downloadExpiryDays = null;
    let isDownloadable = Boolean(item.isDownloadable);

    // If item doesn't explicitly have the digital flags populated, load from DB
    let product = null;
    let variant = null;

    if (variantId) {
      variant = await ProductVariant.findById(variantId).session(session);
      if (variant && variant.isDownloadable && Array.isArray(variant.downloadableFiles) && variant.downloadableFiles.length > 0) {
        isDownloadable = true;
        downloadableFiles = variant.downloadableFiles;
        downloadLimit = variant.downloadLimit;
        downloadExpiryDays = variant.downloadExpiryDays;
      }
    }

    if (downloadableFiles.length === 0) {
      product = await Product.findById(productId).session(session);
      if (product && product.isDownloadable && Array.isArray(product.downloadableFiles) && product.downloadableFiles.length > 0) {
        isDownloadable = true;
        downloadableFiles = product.downloadableFiles;
        downloadLimit = product.downloadLimit;
        downloadExpiryDays = product.downloadExpiryDays;
      }
    }

    if (!isDownloadable || downloadableFiles.length === 0) {
      continue;
    }

    let orderUserId = order.userId || null;
    if (!orderUserId && order.customerId) {
      try {
        const customerDoc = await Customer.findById(order.customerId).session(session);
        if (customerDoc && customerDoc.userId) {
          orderUserId = customerDoc.userId;
        }
      } catch (_) {}
    }

    // For each downloadable file in this product/variant, create/upsert an entitlement
    for (const file of downloadableFiles) {
      let expiresAt = null;
      if (typeof downloadExpiryDays === "number" && downloadExpiryDays > 0) {
        expiresAt = new Date(Date.now() + downloadExpiryDays * 24 * 60 * 60 * 1000);
      }

      const query = {
        orderId: order._id,
        orderItemId: item._id,
        productId: item.productId,
        productVariantId: item.productVariantId || null,
        "asset.id": file.id,
      };

      const setOnInsert = {
        customerId: order.customerId,
        userId: orderUserId,
        orderId: order._id,
        orderNumber: order.orderNumber || "",
        orderItemId: item._id,
        productId: item.productId,
        productVariantId: item.productVariantId || null,
        productName: item.productName || item.name || (product && (product.title || product.name)) || "Digital Product",
        productTitle: item.productName || item.name || (product && (product.title || product.name)) || "Digital Product",
        variantTitle: item.variantName || (variant && variant.name) || null,
        sku: item.sku || (product && product.sku) || "",
        asset: {
          id: file.id,
          name: file.name,
          fileName: file.fileName || file.name,
          storageKey: file.storageKey || null,
          fileKey: file.storageKey || file.id,
          fileSize: file.fileSize || 0,
          mimeType: file.mimeType || "application/octet-stream",
          version: file.version || "1.0",
        },
        downloadLimit: typeof downloadLimit === "number" ? downloadLimit : null,
        downloadCount: 0,
        expiresAt,
        status: "active",
      };

      const entitlement = await DigitalEntitlement.findOneAndUpdate(
        query,
        { $setOnInsert: setOnInsert },
        { upsert: true, new: true, session }
      );

      createdEntitlements.push(entitlement);
    }
  }

  logger.info("Processed digital entitlements for order", {
    orderId: order._id,
    entitlementsCount: createdEntitlements.length,
  });

  return createdEntitlements;
};

/**
 * Revoke entitlements associated with an order (e.g., cancellation or full refund)
 */
const revokeEntitlementsForOrder = async (orderId, reason = "Order cancelled or refunded", revokedBy = null, options = {}) => {
  if (mongoose.connection.readyState === 0) {
    return { modifiedCount: 0 };
  }

  const session = options.session || null;

  const result = await DigitalEntitlement.updateMany(
    { orderId, status: { $ne: "revoked" } },
    {
      $set: {
        status: "revoked",
        revokedAt: new Date(),
        revocationReason: reason,
        revokedBy: revokedBy || null,
        updatedAt: new Date(),
      },
    },
    { session }
  );

  logger.info("Revoked digital entitlements for order", {
    orderId,
    modifiedCount: result.modifiedCount,
    reason,
  });

  return result;
};

/**
 * List customer entitlements with availability calculations and pagination
 */
const listCustomerEntitlements = async (customerId, { page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  let query = { customerId };
  if (customerId) {
    try {
      const customerDoc = await Customer.findById(customerId);
      if (customerDoc && customerDoc.userId) {
        query = {
          $or: [
            { customerId: customerDoc._id },
            { userId: customerDoc.userId },
          ],
        };
      }
    } catch (_) {}
  }

  const [total, entitlements] = await Promise.all([
    DigitalEntitlement.countDocuments(query),
    DigitalEntitlement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("orderId", "orderNumber status paymentStatus createdAt")
      .populate("productId", "title name slug images")
      .lean(),
  ]);

  const now = new Date();
  const formattedItems = entitlements.map((ent) => {
    const isExpired = ent.expiresAt ? new Date(ent.expiresAt) < now : false;
    const isExhausted = ent.downloadLimit !== null ? ent.downloadCount >= ent.downloadLimit : false;
    const isRevoked = ent.status === "revoked";

    let effectiveStatus = ent.status;
    if (isRevoked) {
      effectiveStatus = "revoked";
    } else if (isExpired) {
      effectiveStatus = "expired";
    } else if (isExhausted) {
      effectiveStatus = "exhausted";
    }

    const isAvailable = !isRevoked && !isExpired && !isExhausted;
    const remainingDownloads =
      ent.downloadLimit === null ? null : Math.max(0, ent.downloadLimit - ent.downloadCount);

    return {
      id: ent._id,
      orderId: ent.orderId ? ent.orderId._id : null,
      orderNumber: ent.orderId ? ent.orderId.orderNumber : null,
      product: {
        id: ent.productId ? ent.productId._id : null,
        title: ent.productTitle || (ent.productId && (ent.productId.title || ent.productId.name)),
        slug: ent.productId ? ent.productId.slug : null,
        image: ent.productId && ent.productId.images && ent.productId.images[0] ? ent.productId.images[0].url : null,
      },
      variantTitle: ent.variantTitle,
      asset: {
        id: ent.asset.id,
        name: ent.asset.name,
        fileName: ent.asset.fileName,
        fileSize: ent.asset.fileSize,
        mimeType: ent.asset.mimeType,
        version: ent.asset.version,
      },
      downloadLimit: ent.downloadLimit,
      downloadCount: ent.downloadCount,
      remainingDownloads,
      expiresAt: ent.expiresAt,
      status: effectiveStatus,
      isAvailable,
      createdAt: ent.createdAt,
    };
  });

  return {
    items: formattedItems,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * Authorize download request and increment download count atomically
 */
const authorizeAndDeliverDownload = async (entitlementId, user, req) => {
  if (!mongoose.isValidObjectId(entitlementId)) {
    throw new AppError("Invalid entitlement ID", 400, "INVALID_ENTITLEMENT_ID");
  }

  const entitlement = await DigitalEntitlement.findById(entitlementId);
  if (!entitlement) {
    throw new AppError("Digital entitlement not found", 404, "ENTITLEMENT_NOT_FOUND");
  }

  // Authorization check: Customer or User must own this entitlement (unless admin)
  let isOwner = false;
  const isAdmin =
    user &&
    (user.role === "admin" ||
      user.role === "superadmin" ||
      user.role === "super_admin");

  if (user && (user._id || user.id)) {
    const userStr = (user._id || user.id).toString();
    if (entitlement.userId && entitlement.userId.toString() === userStr) {
      isOwner = true;
    } else if (entitlement.customerId && entitlement.customerId.toString() === userStr) {
      isOwner = true;
    } else {
      try {
        const customerDoc = await Customer.findOne({ userId: user._id || user.id });
        if (
          customerDoc &&
          entitlement.customerId &&
          entitlement.customerId.toString() === customerDoc._id.toString()
        ) {
          isOwner = true;
        }
      } catch (_) {}
    }
  }

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not authorized to download this file", 403, "FORBIDDEN_DOWNLOAD_ACCESS");
  }

  // Check revocation
  if (entitlement.status === "revoked") {
    throw new AppError(
      `Access to this download has been revoked: ${entitlement.revocationReason || "Order refunded or cancelled"}`,
      403,
      "ENTITLEMENT_REVOKED"
    );
  }

  const now = new Date();

  // Check expiration
  if (entitlement.expiresAt && new Date(entitlement.expiresAt) < now) {
    if (entitlement.status !== "expired") {
      await DigitalEntitlement.updateOne({ _id: entitlement._id }, { status: "expired" });
    }
    throw new AppError("Download access has expired for this purchase", 410, "ENTITLEMENT_EXPIRED");
  }

  // Check limit
  if (entitlement.downloadLimit !== null && entitlement.downloadCount >= entitlement.downloadLimit) {
    if (entitlement.status !== "exhausted") {
      await DigitalEntitlement.updateOne({ _id: entitlement._id }, { status: "exhausted" });
    }
    throw new AppError(
      `Download limit of ${entitlement.downloadLimit} downloads has been reached`,
      403,
      "DOWNLOAD_LIMIT_EXHAUSTED"
    );
  }

  // Atomic increment and log to prevent race conditions bypassing limits
  const ipAddress = req.ip || (req.headers && req.headers["x-forwarded-for"]) || "127.0.0.1";
  const userAgent = (req.headers && req.headers["user-agent"]) || "unknown";

  const conditions = {
    _id: entitlementId,
    status: { $in: ["active"] },
    $and: [
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      },
      {
        $or: [
          { downloadLimit: null },
          { $expr: { $lt: ["$downloadCount", "$downloadLimit"] } },
        ],
      },
    ],
  };

  const updatedEntitlement = await DigitalEntitlement.findOneAndUpdate(
    conditions,
    {
      $inc: { downloadCount: 1 },
      $push: {
        downloadLogs: {
          ipAddress,
          userAgent,
          downloadedAt: now,
          success: true,
        },
      },
      $set: { updatedAt: now },
    },
    { new: true }
  );

  if (!updatedEntitlement) {
    // Re-check why atomic update failed
    const latest = await DigitalEntitlement.findById(entitlementId);
    if (!latest || latest.status === "revoked") {
      throw new AppError("Access to this download has been revoked", 403, "ENTITLEMENT_REVOKED");
    }
    if (latest.expiresAt && latest.expiresAt < now) {
      throw new AppError("Download access has expired", 410, "ENTITLEMENT_EXPIRED");
    }
    if (latest.downloadLimit !== null && latest.downloadCount >= latest.downloadLimit) {
      throw new AppError("Download limit has been reached", 403, "DOWNLOAD_LIMIT_EXHAUSTED");
    }
    throw new AppError("Download authorization failed", 400, "DOWNLOAD_AUTHORIZATION_FAILED");
  }

  // If download limit is now reached, mark as exhausted
  if (
    updatedEntitlement.downloadLimit !== null &&
    updatedEntitlement.downloadCount >= updatedEntitlement.downloadLimit
  ) {
    await DigitalEntitlement.updateOne({ _id: entitlementId }, { status: "exhausted" });
  }

  // Get stream from private digital storage
  const storageKey = updatedEntitlement.asset.storageKey;
  if (!storageKey) {
    throw new AppError("Asset storage reference missing", 404, "DIGITAL_ASSET_NOT_FOUND");
  }

  const { stream, size } = await digitalStorageService.getDigitalAssetStream(storageKey);

  logger.info("Authorized and initiated digital asset delivery", {
    entitlementId: updatedEntitlement._id,
    customerId: updatedEntitlement.customerId,
    downloadCount: updatedEntitlement.downloadCount,
    downloadLimit: updatedEntitlement.downloadLimit,
    storageKey,
  });

  return {
    stream,
    size,
    mimeType: updatedEntitlement.asset.mimeType || "application/octet-stream",
    fileName: updatedEntitlement.asset.fileName || `${updatedEntitlement.asset.name}.bin`,
  };
};

/**
 * Admin: List all entitlements with filters
 */
const adminListEntitlements = async (filter = {}, { page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (filter.status) query.status = filter.status;
  if (filter.orderId && mongoose.isValidObjectId(filter.orderId)) query.orderId = filter.orderId;
  if (filter.customerId && mongoose.isValidObjectId(filter.customerId)) query.customerId = filter.customerId;
  if (filter.productId && mongoose.isValidObjectId(filter.productId)) query.productId = filter.productId;

  const [total, items] = await Promise.all([
    DigitalEntitlement.countDocuments(query),
    DigitalEntitlement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("orderId", "orderNumber status paymentStatus")
      .populate("customerId", "name email")
      .populate("productId", "title name")
      .lean(),
  ]);

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * Admin: Revoke single entitlement manually
 */
const adminRevokeEntitlement = async (entitlementId, reason, adminId) => {
  if (!mongoose.isValidObjectId(entitlementId)) {
    throw new AppError("Invalid entitlement ID", 400, "INVALID_ENTITLEMENT_ID");
  }

  const entitlement = await DigitalEntitlement.findByIdAndUpdate(
    entitlementId,
    {
      $set: {
        status: "revoked",
        revokedAt: new Date(),
        revocationReason: reason || "Revoked by administrator",
        revokedBy: adminId,
        updatedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!entitlement) {
    throw new AppError("Digital entitlement not found", 404, "ENTITLEMENT_NOT_FOUND");
  }

  logger.info("Admin revoked digital entitlement", { entitlementId, adminId, reason });
  return entitlement;
};

/**
 * Admin: Reset or extend entitlement
 */
const adminResetEntitlement = async (entitlementId, { addDownloads = 0, extendDays = 0 } = {}, adminId) => {
  if (!mongoose.isValidObjectId(entitlementId)) {
    throw new AppError("Invalid entitlement ID", 400, "INVALID_ENTITLEMENT_ID");
  }

  const entitlement = await DigitalEntitlement.findById(entitlementId);
  if (!entitlement) {
    throw new AppError("Digital entitlement not found", 404, "ENTITLEMENT_NOT_FOUND");
  }

  const updates = { updatedAt: new Date() };

  if (addDownloads > 0 && entitlement.downloadLimit !== null) {
    updates.downloadLimit = entitlement.downloadLimit + addDownloads;
  }

  if (extendDays > 0) {
    const baseDate = entitlement.expiresAt && entitlement.expiresAt > new Date()
      ? entitlement.expiresAt
      : new Date();
    updates.expiresAt = new Date(baseDate.getTime() + extendDays * 24 * 60 * 60 * 1000);
  }

  // If restoring from expired, exhausted, or revoked
  updates.status = "active";
  updates.revokedAt = null;
  updates.revocationReason = null;
  updates.revokedBy = null;

  const updated = await DigitalEntitlement.findByIdAndUpdate(
    entitlementId,
    { $set: updates },
    { new: true }
  );

  logger.info("Admin reset/extended digital entitlement", { entitlementId, adminId, updates });
  return updated;
};

module.exports = {
  createEntitlementsForOrder,
  revokeEntitlementsForOrder,
  listCustomerEntitlements,
  authorizeAndDeliverDownload,
  adminListEntitlements,
  adminRevokeEntitlement,
  adminResetEntitlement,
};
