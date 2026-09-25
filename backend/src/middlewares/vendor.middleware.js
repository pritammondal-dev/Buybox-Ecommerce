const AppError = require("../errors/AppError");
const Vendor = require("../models/Vendor");
const { ROLES } = require("../constants/auth.constants");

/**
 * Resolve the authenticated vendor profile and verify approval status.
 * Fails closed if the caller is not an approved, active vendor.
 *
 * @param {string} userId
 * @returns {Promise<import("../models/Vendor")>}
 */
const resolveApprovedVendor = async (userId) => {
  if (!userId) {
    throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
  }

  const vendor = await Vendor.findOne({
    userId,
    deletedAt: null,
  });

  if (!vendor) {
    throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
  }

  if (vendor.onboardingStatus !== "approved") {
    throw new AppError(
      `Vendor onboarding is currently '${vendor.onboardingStatus}'. Approved status required for marketplace operations.`,
      403,
      "VENDOR_ONBOARDING_NOT_APPROVED"
    );
  }

  if (!vendor.isActive) {
    throw new AppError("Vendor account is inactive or disabled", 403, "VENDOR_INACTIVE");
  }

  return vendor;
};

const resolveVendor = async (userId) => {
  if (!userId) {
    throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
  }

  const vendor = await Vendor.findOne({
    userId,
    deletedAt: null,
  });

  if (!vendor) {
    throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
  }

  return vendor;
};

/**
 * Express middleware enforcing approved vendor access.
 * Rejects unauthenticated users, non-vendors, pending/under_review vendors,
 * and suspended/inactive vendors.
 * Attaches verified vendor document to `req.vendor`.
 */
const requireApprovedVendor = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
    }

    // Platform administrative override: admins and super admins can view console operations
    if ([ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role)) {
      const targetVendorId = req.query.vendorId || req.headers["x-vendor-id"];
      let vendor = null;
      if (targetVendorId) {
        vendor = await Vendor.findById(targetVendorId);
      }
      if (!vendor) {
        vendor = await Vendor.findOne({ deletedAt: null, isActive: true, onboardingStatus: "approved" });
      }
      if (!vendor) {
        vendor = await Vendor.findOne({ deletedAt: null });
      }
      if (vendor) {
        req.vendor = vendor;
      }
      return next();
    }

    if (req.user.role !== ROLES.VENDOR) {
      throw new AppError(
        "Vendor access required for this operation",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    const vendor = await resolveApprovedVendor(req.user.id);
    req.vendor = vendor;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Express middleware ensuring caller is an authentic vendor (approved or pending onboarding).
 * Useful for dashboard metrics and activity views where pending sellers view their status.
 */
const requireVendorSession = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
    }

    if ([ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role)) {
      const targetVendorId = req.query.vendorId || req.headers["x-vendor-id"];
      let vendor = null;
      if (targetVendorId) {
        vendor = await Vendor.findById(targetVendorId);
      }
      if (!vendor) {
        vendor = await Vendor.findOne({ deletedAt: null, isActive: true, onboardingStatus: "approved" });
      }
      if (!vendor) {
        vendor = await Vendor.findOne({ deletedAt: null });
      }
      if (vendor) {
        req.vendor = vendor;
      }
      return next();
    }

    if (req.user.role !== ROLES.VENDOR) {
      throw new AppError(
        "Vendor access required for this operation",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    const vendor = await resolveVendor(req.user.id);
    req.vendor = vendor;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireApprovedVendor,
  requireVendorSession,
  resolveApprovedVendor,
  resolveVendor,
};
