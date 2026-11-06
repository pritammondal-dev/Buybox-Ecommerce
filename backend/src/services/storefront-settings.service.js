const mongoose = require("mongoose");
const storefrontSettingsRepository = require("../repositories/storefront-settings.repository");
const AppError = require("../errors/AppError");
const { recordAuditLog, sanitizeAuditState } = require("./governance.service");

const DEFAULT_SETTINGS = {
  storeName: "Buybox Marketplace",
  tagline: "High-Performance Audio, Tech & Peripherals",
  logoUrl: "/images/logo.svg",
  faviconUrl: "/favicon.ico",
  logoDimensions: {
    desktopWidth: 160,
    desktopMaxHeight: 48,
    mobileWidth: 120,
    mobileMaxHeight: 36,
    footerMaxHeight: 40,
  },
  theme: {
    primaryColor: "#007A55",
    secondaryColor: "#F8F9FA",
  },
  contact: {
    email: "support@buybox.test",
    phone: "+91 98765 43210",
    address: "Tech Hub, Sector V, Salt Lake, Kolkata, West Bengal 700091",
  },
  socialLinks: {
    facebook: "https://facebook.com/buybox",
    instagram: "https://instagram.com/buybox",
    twitter: "https://twitter.com/buybox",
    youtube: "https://youtube.com/buybox",
    linkedin: "https://linkedin.com/company/buybox",
  },
  currency: {
    code: "INR",
    symbol: "₹",
  },
  timezone: "Asia/Kolkata",
  language: "en",
  maintenanceMode: false,
  featureFlags: {
    coupons: true,
    flashSale: true,
    vendorRegistration: true,
    vendorApprovalRequired: true,
    productApprovalRequired: true,
    reviews: true,
    wishlist: true,
    compare: true,
    guestCheckout: false,
    customerRegistration: true,
    returns: true,
    giftCards: true,
  },
  policies: {
    returnWindowDays: 7,
    refundWindowDays: 7,
    minOrderValue: 0,
    freeShippingThreshold: 999,
    defaultTaxRate: 18,
    lowStockThreshold: 5,
  },
  isActive: true,
};

let cachedSettings = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const invalidateCache = () => {
  cachedSettings = null;
  cacheTimestamp = 0;
};

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

/**
 * Fetch authoritative active storefront settings.
 * Auto-seeds default settings in database if none exist yet.
 */
const getActiveSettings = async () => {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  // If MongoDB is not connected (e.g. in isolated unit tests), fallback immediately to defaults
  if (mongoose.connection?.readyState !== 1) {
    return cachedSettings || DEFAULT_SETTINGS;
  }

  let settings = await storefrontSettingsRepository.findActive();

  if (!settings) {
    try {
      settings = await storefrontSettingsRepository.create(DEFAULT_SETTINGS);
    } catch {
      settings = await storefrontSettingsRepository.findActive();
    }
  }

  if (!settings) {
    return DEFAULT_SETTINGS;
  }

  cachedSettings = settings;
  cacheTimestamp = now;
  return settings;
};

/**
 * Check whether a platform feature flag is enabled in real-time.
 *
 * @param {string} flagKey - E.g. 'coupons', 'vendorRegistration', 'reviews', 'wishlist'
 * @returns {Promise<boolean>}
 */
const isFeatureEnabled = async (flagKey) => {
  try {
    const settings = await getActiveSettings();
    if (!settings || !settings.featureFlags) {
      if (DEFAULT_SETTINGS.featureFlags && flagKey in DEFAULT_SETTINGS.featureFlags) {
        return Boolean(DEFAULT_SETTINGS.featureFlags[flagKey]);
      }
      return true; // Default permissive fallback for unknown keys
    }
    const val = settings.featureFlags[flagKey];
    if (val === undefined || val === null) {
      if (DEFAULT_SETTINGS.featureFlags && flagKey in DEFAULT_SETTINGS.featureFlags) {
        return Boolean(DEFAULT_SETTINGS.featureFlags[flagKey]);
      }
      return true;
    }
    return Boolean(val);
  } catch {
    if (DEFAULT_SETTINGS.featureFlags && flagKey in DEFAULT_SETTINGS.featureFlags) {
      return Boolean(DEFAULT_SETTINGS.featureFlags[flagKey]);
    }
    return true;
  }
};

const getSettingsById = async (settingsId) => {
  validateObjectId(settingsId, "settings ID");

  const settings = await storefrontSettingsRepository.findById(settingsId);

  if (!settings) {
    throw new AppError(
      "Storefront settings not found",
      404,
      "STOREFRONT_SETTINGS_NOT_FOUND"
    );
  }

  return settings;
};

const createSettings = async (data, userId) => {
  if (userId) validateObjectId(userId, "user ID");

  const existing = await storefrontSettingsRepository.findActive();

  if (existing) {
    throw new AppError(
      "Active storefront settings already exist",
      409,
      "STOREFRONT_SETTINGS_ALREADY_EXISTS"
    );
  }

  const created = await storefrontSettingsRepository.create({
    ...data,
    updatedBy: userId || null,
    isActive: true,
  });

  invalidateCache();

  if (userId) {
    await recordAuditLog({
      actorId: userId,
      targetId: created._id,
      action: "CREATE_PLATFORM_SETTINGS",
      entityType: "StorefrontSettings",
      beforeState: null,
      afterState: sanitizeAuditState(created),
    }).catch(() => {});
  }

  return created;
};

const isSuperAdminRole = (role) => {
  if (!role) return false;
  const normalized = String(role).toLowerCase().replace(/[-_]/g, "");
  return normalized === "superadmin";
};

const updateSettings = async (settingsId, data, userId, actorRole) => {
  if (userId) validateObjectId(userId, "user ID");

  const current = settingsId
    ? await getSettingsById(settingsId)
    : await getActiveSettings();

  const targetId = current._id || settingsId;

  const updateData = { ...data };

  // Explicitly check featureFlags authorization if provided in settings payload
  if (updateData.featureFlags !== undefined) {
    const isSuper = isSuperAdminRole(actorRole);
    if (!isSuper) {
      throw new AppError(
        "Only Superadmin is authorized to modify platform feature flags",
        403,
        "SUPERADMIN_REQUIRED"
      );
    }
  }

  const updated = await storefrontSettingsRepository.updateById(targetId, {
    ...updateData,
    updatedBy: userId || null,
  });

  invalidateCache();

  if (userId) {
    await recordAuditLog({
      actorId: userId,
      targetId,
      action: "UPDATE_PLATFORM_SETTINGS",
      entityType: "StorefrontSettings",
      beforeState: sanitizeAuditState(current),
      afterState: sanitizeAuditState(updated),
    }).catch(() => {});
  }

  return updated;
};

const updateFeatureFlags = async (featureFlags, userId, actorRole) => {
  if (actorRole && !isSuperAdminRole(actorRole)) {
    throw new AppError(
      "Only Superadmin is authorized to modify platform feature flags",
      403,
      "SUPERADMIN_REQUIRED"
    );
  }

  const current = await getActiveSettings();
  const targetId = current._id;

  const mergedFlags = {
    ...(current.featureFlags?.toObject?.() || current.featureFlags || {}),
    ...featureFlags,
  };

  const updated = await storefrontSettingsRepository.updateById(targetId, {
    featureFlags: mergedFlags,
    updatedBy: userId || null,
  });

  invalidateCache();

  if (userId) {
    await recordAuditLog({
      actorId: userId,
      targetId,
      action: "UPDATE_FEATURE_FLAGS",
      entityType: "StorefrontSettings",
      beforeState: sanitizeAuditState(current.featureFlags),
      afterState: sanitizeAuditState(mergedFlags),
    }).catch(() => {});
  }

  return updated;
};

module.exports = {
  DEFAULT_SETTINGS,
  getActiveSettings,
  getSettingsById,
  createSettings,
  updateSettings,
  updateFeatureFlags,
  isFeatureEnabled,
  invalidateCache,
};