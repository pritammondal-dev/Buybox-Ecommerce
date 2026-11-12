const mongoose = require("mongoose");
const vendorRepository = require("../repositories/vendor.repository");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const ReturnRequest = require("../models/ReturnRequest");
const { VendorSettlement } = require("../models/VendorSettlement");
const AuditLog = require("../models/AuditLog");
const RefreshToken = require("../models/RefreshToken");
const { hashPassword } = require("../utils/password");
const { ROLES } = require("../constants/auth.constants");
const AppError = require("../errors/AppError");
const { encodeSecureId, decodeSecureId } = require("../utils/secure-id.util");
const { projectVendorOrder } = require("./order.service");
const EmailService = require("./email.service");
const emailService = new EmailService();
const { recordAuditLog } = require("./governance.service");
const logger = require("../config/logger");
const env = require("../config/env");
const { normalizePhoneNumber } = require("../utils/phone.util");
const path = require("path");
const crypto = require("crypto");
const { uploadPublicMedia } = require("./storage");

const registerVendor = async (
  {
    email,
    password,
    firstName,
    lastName,
    businessName,
    businessSlug,
    phone,
    supportEmail,
    businessAddress,
    taxInformation,
  },
  authenticatedUser = null
) => {
  const { isFeatureEnabled } = require("./storefront-settings.service");
  const vendorRegistrationEnabled = await isFeatureEnabled("vendorRegistration");
  if (!vendorRegistrationEnabled) {
    throw new AppError(
      "Vendor registration is currently disabled by platform administration",
      403,
      "VENDOR_REGISTRATION_DISABLED"
    );
  }
  const vendorApprovalRequired = await isFeatureEnabled("vendorApprovalRequired");
  const initialOnboardingStatus = vendorApprovalRequired ? "pending" : "approved";
  const initialIsActive = !vendorApprovalRequired;

  const normalizedEmail = String(email || "").toLowerCase().trim();
  const slug =
    businessSlug?.trim()?.toLowerCase() ||
    businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") + `-${Date.now().toString(36)}`;

  // 1. Check for existing user account
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    // Internal platform staff accounts cannot register as marketplace vendors
    if (["super_admin", "admin", "editor", "manager", "support"].includes(existingUser.role)) {
      throw new AppError(
        "Internal platform staff accounts cannot register as marketplace vendors.",
        403,
        "STAFF_CANNOT_BE_VENDOR"
      );
    }

    const existingVendor = await Vendor.findOne({ userId: existingUser._id });

    // 1A. User already has a registered Vendor application (Idempotent recovery)
    if (existingVendor) {
      if (existingVendor.onboardingStatus === "approved") {
        return {
          user: {
            id: existingUser._id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            role: ROLES.VENDOR,
            roles: existingUser.roles || [existingUser.role, ROLES.VENDOR],
            isEmailVerified: Boolean(existingUser.isEmailVerified),
            requireVerification: !existingUser.isEmailVerified,
          },
          vendor: {
            id: existingVendor._id,
            businessName: existingVendor.businessName,
            businessSlug: existingVendor.businessSlug,
            onboardingStatus: existingVendor.onboardingStatus,
            isActive: existingVendor.isActive,
          },
          isExistingApplication: true,
          emailDelivery: {
            sent: true,
            message: "An approved vendor account already exists for this email. Please sign in to the Merchant Center.",
          },
        };
      }

      // Existing unverified vendor: Resume verification lifecycle without creating duplicate records
      if (!existingUser.isEmailVerified) {
        const otpService = require("./otp.service");
        let otp = null;
        let resendCooldownSeconds = 60;
        let isEmailSent = true;

        try {
          const otpResult = await otpService.generateOtp({
            email: normalizedEmail,
            userId: existingUser._id,
            purpose: "email_verification",
          });
          otp = otpResult.otp;
          resendCooldownSeconds = otpResult.resendCooldownSeconds;

          const emailResult = await emailService.sendEmailVerificationOTP({
            to: normalizedEmail,
            customerName: existingUser.firstName,
            otp,
          });

          isEmailSent = Boolean(emailResult && emailResult.success);
          if (!isEmailSent) {
            logger.warn("Failed to deliver vendor verification email on retry:", {
              recipient: normalizedEmail,
              status: emailResult?.status,
              error: emailResult?.error,
            });
            if (env.NODE_ENV === "development" && env.ENABLE_DEV_OTP_LOGGING === true) {
              console.log(`[DEV-MODE ONLY] Vendor verification OTP for ${normalizedEmail}: ${otp}`);
            }
          }
        } catch (otpErr) {
          if (
            otpErr?.code === "RESEND_COOLDOWN_ACTIVE" ||
            otpErr?.code === "OTP_COOLDOWN_ACTIVE" ||
            otpErr?.statusCode === 429
          ) {
            // Active verification code already in flight within cooldown window
            isEmailSent = true;
            resendCooldownSeconds = otpErr?.data?.retryAfter || 60;
          } else {
            throw otpErr;
          }
        }

        return {
          user: {
            id: existingUser._id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            role: ROLES.VENDOR,
            roles: existingUser.roles || [existingUser.role, ROLES.VENDOR],
            isEmailVerified: false,
            requireVerification: true,
          },
          vendor: {
            id: existingVendor._id,
            businessName: existingVendor.businessName,
            businessSlug: existingVendor.businessSlug,
            onboardingStatus: existingVendor.onboardingStatus,
            isActive: existingVendor.isActive,
          },
          isExistingApplication: true,
          resendCooldownSeconds,
          emailDelivery: {
            sent: isEmailSent,
            message: isEmailSent
              ? "Verification email dispatched successfully."
              : "Verification email could not be delivered at this time. Please use the resend code button on the verification screen.",
          },
        };
      }

      // Existing verified user with pending application
      return {
        user: {
          id: existingUser._id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: ROLES.VENDOR,
          roles: existingUser.roles || [existingUser.role, ROLES.VENDOR],
          isEmailVerified: true,
          requireVerification: false,
        },
        vendor: {
          id: existingVendor._id,
          businessName: existingVendor.businessName,
          businessSlug: existingVendor.businessSlug,
          onboardingStatus: existingVendor.onboardingStatus,
          isActive: existingVendor.isActive,
        },
        isExistingApplication: true,
        emailDelivery: {
          sent: true,
          message:
            existingVendor.onboardingStatus === "changes_requested"
              ? "Changes were requested on your vendor application. Please sign in to update details."
              : existingVendor.onboardingStatus === "rejected"
              ? "Your vendor application was previously rejected. Please contact administrator support."
              : "Your vendor application has already been submitted and is pending administrator review.",
        },
      };
    }

    // 1B. Existing customer applying to become a Vendor for the first time (Shared Identity)
    const authUserId = authenticatedUser?.id || authenticatedUser?._id;
    if (authUserId && authUserId.toString() !== existingUser._id.toString()) {
      throw new AppError(
        "You cannot apply as a vendor using another user's email address.",
        403,
        "FORBIDDEN"
      );
    }

    let normalizedPhone = undefined;
    if (phone && String(phone).trim()) {
      normalizedPhone = normalizePhoneNumber(String(phone).trim());
      const existingPhone = await User.findOne({ phone: normalizedPhone, _id: { $ne: existingUser._id } });
      if (existingPhone) {
        throw new AppError("A user account is already associated with this phone number.", 409, "PHONE_ALREADY_EXISTS");
      }
    }

    const sanitizedAddress = businessAddress ? { ...businessAddress } : {};
    if (sanitizedAddress.country) {
      const normalizedCountry = String(sanitizedAddress.country).trim().toUpperCase();
      if (normalizedCountry.length !== 2) {
        throw new AppError("Country must be a 2-letter ISO country code (e.g. IN, US)", 400, "INVALID_COUNTRY_CODE");
      }
      sanitizedAddress.country = normalizedCountry;
    } else {
      sanitizedAddress.country = "IN";
    }

    const session = await mongoose.startSession();
    try {
      let createdVendorDoc;

      await session.withTransaction(async () => {
        const existingSlug = await Vendor.findOne({ businessSlug: slug }).session(session);
        if (existingSlug) {
          throw new AppError("Business slug is already in use", 409, "BUSINESS_SLUG_ALREADY_EXISTS");
        }

        const createdVendors = await Vendor.create(
          [
            {
              userId: existingUser._id,
              businessName,
              businessSlug: slug,
              phone: normalizedPhone || existingUser.phone || null,
              supportEmail: supportEmail || existingUser.email,
              businessAddress: sanitizedAddress,
              taxInformation: taxInformation || {},
              onboardingStatus: initialOnboardingStatus,
              isActive: initialIsActive,
              commissionRate: 0,
            },
          ],
          { session }
        );

        createdVendorDoc = createdVendors[0];

        const updatedRoles = Array.from(
          new Set([...(existingUser.roles || [existingUser.role || "customer"]), ROLES.CUSTOMER, ROLES.VENDOR])
        );

        // Security requirement: Preserve existing customer password hash, Google OAuth, and verification state.
        // Never overwrite an existing password because the vendor form includes a password field.
        const userUpdates = {
          roles: updatedRoles,
        };

        if (normalizedPhone && !existingUser.phone) {
          userUpdates.phone = normalizedPhone;
        }

        await User.updateOne({ _id: existingUser._id }, { $set: userUpdates }).session(session);
      });

      // Email verification status preservation
      if (existingUser.isEmailVerified) {
        return {
          user: {
            id: existingUser._id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            role: ROLES.VENDOR,
            roles: Array.from(
              new Set([...(existingUser.roles || [existingUser.role || "customer"]), ROLES.CUSTOMER, ROLES.VENDOR])
            ),
            isEmailVerified: true,
            requireVerification: false,
          },
          vendor: {
            id: createdVendorDoc._id,
            businessName: createdVendorDoc.businessName,
            businessSlug: createdVendorDoc.businessSlug,
            onboardingStatus: createdVendorDoc.onboardingStatus,
            isActive: createdVendorDoc.isActive,
          },
          isLinkedApplication: true,
          isExistingUser: true,
          emailDelivery: {
            sent: true,
            message: "Vendor application submitted successfully. Account pending administrator review.",
          },
        };
      }

      // If existing user email is unverified, trigger OTP verification
      const otpService = require("./otp.service");
      const { otp, resendCooldownSeconds } = await otpService.generateOtp({
        email: normalizedEmail,
        userId: existingUser._id,
        purpose: "email_verification",
      });

      const emailResult = await emailService.sendEmailVerificationOTP({
        to: normalizedEmail,
        customerName: existingUser.firstName,
        otp,
      });

      const isEmailSent = Boolean(emailResult && emailResult.success);
      if (!isEmailSent) {
        logger.warn("Failed to deliver vendor verification email:", {
          recipient: normalizedEmail,
          status: emailResult?.status,
          error: emailResult?.error,
        });
        if (env.NODE_ENV === "development" && env.ENABLE_DEV_OTP_LOGGING === true) {
          console.log(`[DEV-MODE ONLY] Vendor verification OTP for ${normalizedEmail}: ${otp}`);
        }
      }

      return {
        user: {
          id: existingUser._id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: ROLES.VENDOR,
          roles: Array.from(
            new Set([...(existingUser.roles || [existingUser.role || "customer"]), ROLES.CUSTOMER, ROLES.VENDOR])
          ),
          isEmailVerified: false,
          requireVerification: true,
        },
        vendor: {
          id: createdVendorDoc._id,
          businessName: createdVendorDoc.businessName,
          businessSlug: createdVendorDoc.businessSlug,
          onboardingStatus: createdVendorDoc.onboardingStatus,
          isActive: createdVendorDoc.isActive,
        },
        isLinkedApplication: true,
        isExistingUser: true,
        resendCooldownSeconds,
        emailDelivery: {
          sent: isEmailSent,
          message: isEmailSent
            ? "Verification email dispatched successfully."
            : "Verification email could not be delivered at this time. Please use the resend code button on the verification screen.",
        },
      };
    } finally {
      await session.endSession();
    }
  }

  // 2. Brand new user registration transaction
  let normalizedPhone = undefined;
  if (phone && String(phone).trim()) {
    normalizedPhone = normalizePhoneNumber(String(phone).trim());
    const existingPhone = await User.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      throw new AppError("A user account is already associated with this phone number.", 409, "PHONE_ALREADY_EXISTS");
    }
  }

  const sanitizedAddress = businessAddress ? { ...businessAddress } : {};
  if (sanitizedAddress.country) {
    const normalizedCountry = String(sanitizedAddress.country).trim().toUpperCase();
    if (normalizedCountry.length !== 2) {
      throw new AppError("Country must be a 2-letter ISO country code (e.g. IN, US)", 400, "INVALID_COUNTRY_CODE");
    }
    sanitizedAddress.country = normalizedCountry;
  } else {
    sanitizedAddress.country = "IN";
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const existingSlug = await Vendor.findOne({ businessSlug: slug }).session(session);
      if (existingSlug) {
        throw new AppError("Business slug is already in use", 409, "BUSINESS_SLUG_ALREADY_EXISTS");
      }

      const passwordHash = await hashPassword(password);

      const createdUsers = await User.create(
        [
          {
            email: normalizedEmail,
            phone: normalizedPhone || undefined,
            password: passwordHash,
            firstName,
            lastName,
            role: ROLES.VENDOR,
            roles: [ROLES.CUSTOMER, ROLES.VENDOR],
            isActive: true,
            isEmailVerified: false,
          },
        ],
        { session }
      );

      const user = createdUsers[0];

      const createdVendors = await Vendor.create(
        [
          {
            userId: user._id,
            businessName,
            businessSlug: slug,
            phone: normalizedPhone || null,
            supportEmail: supportEmail || null,
            businessAddress: sanitizedAddress,
            taxInformation: taxInformation || {},
            onboardingStatus: initialOnboardingStatus,
            isActive: initialIsActive,
            commissionRate: 0,
          },
        ],
        { session }
      );

      const vendor = createdVendors[0];

      result = {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          roles: user.roles || [ROLES.CUSTOMER, ROLES.VENDOR],
          isEmailVerified: false,
          requireVerification: true,
        },
        vendor: {
          id: vendor._id,
          businessName: vendor.businessName,
          businessSlug: vendor.businessSlug,
          onboardingStatus: vendor.onboardingStatus,
          isActive: vendor.isActive,
        },
      };
    });

    // 3. Generate secure 6-digit OTP and dispatch via EmailService
    const otpService = require("./otp.service");
    const { otp, resendCooldownSeconds } = await otpService.generateOtp({
      email: normalizedEmail,
      userId: result.user.id,
      purpose: "email_verification",
    });

    const emailResult = await emailService.sendEmailVerificationOTP({
      to: normalizedEmail,
      customerName: result.user.firstName,
      otp,
    });

    const isEmailSent = Boolean(emailResult && emailResult.success);
    if (!isEmailSent) {
      logger.warn("Failed to deliver vendor verification email:", {
        recipient: normalizedEmail,
        status: emailResult?.status,
        error: emailResult?.error,
      });
      if (env.NODE_ENV === "development" && env.ENABLE_DEV_OTP_LOGGING === true) {
        console.log(`[DEV-MODE ONLY] Vendor verification OTP for ${normalizedEmail}: ${otp}`);
      }
    }

    return {
      user: result.user,
      vendor: result.vendor,
      resendCooldownSeconds,
      emailDelivery: {
        sent: isEmailSent,
        message: isEmailSent
          ? "Verification email dispatched successfully."
          : "Verification email could not be delivered at this time. Please use the resend code button on the verification screen.",
      },
    };
  } catch (err) {
    if (err.code === 11000 || (err.message && err.message.includes("duplicate key"))) {
      if (err.message && (err.message.includes("phone_1") || err.message.includes("phone"))) {
        throw new AppError("A user account is already associated with this phone number.", 409, "PHONE_ALREADY_EXISTS");
      }
      if (err.message && err.message.includes("businessSlug")) {
        throw new AppError("Business slug is already in use", 409, "BUSINESS_SLUG_ALREADY_EXISTS");
      }
      throw new AppError(
        "An account may already be associated with this email. Please sign in or use Forgot Password.",
        409,
        "EMAIL_ALREADY_EXISTS"
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

const getMyVendorProfile = async (userId) => {
  const vendor = await vendorRepository.findByUserId(userId);

  if (!vendor) {
    throw new AppError(
      "Vendor profile not found",
      404,
      "VENDOR_NOT_FOUND"
    );
  }

  return vendor;
};

const createVendorProfile = async (userId, data) => {
  const existingVendor =
    await vendorRepository.findByUserId(userId);

  if (existingVendor) {
    throw new AppError(
      "Vendor profile already exists",
      409,
      "VENDOR_ALREADY_EXISTS"
    );
  }

  const existingSlug =
    await vendorRepository.findBySlug(data.businessSlug);

  if (existingSlug) {
    throw new AppError(
      "Business slug is already in use",
      409,
      "BUSINESS_SLUG_ALREADY_EXISTS"
    );
  }

  return vendorRepository.create({
    userId,
    ...data,
    onboardingStatus: "pending",
    isActive: false,
  });
};

const updateMyVendorProfile = async (userId, data) => {
  const sanitizedData = { ...data };
  // Guard sensitive onboarding & internal fields from self-mutation
  delete sanitizedData.onboardingStatus;
  delete sanitizedData.isActive;
  delete sanitizedData.approvedAt;
  delete sanitizedData.approvedBy;
  delete sanitizedData.rejectedAt;
  delete sanitizedData.rejectedBy;
  delete sanitizedData.changesRequestedAt;
  delete sanitizedData.changesRequestedBy;
  delete sanitizedData.changesRequestedReason;
  delete sanitizedData.rejectionReason;
  delete sanitizedData.commissionRate;
  delete sanitizedData.userId;
  delete sanitizedData._id;

  if (sanitizedData.businessSlug) {
    const existingVendor = await vendorRepository.findBySlug(sanitizedData.businessSlug);
    if (existingVendor && existingVendor.userId.toString() !== userId.toString()) {
      throw new AppError("Business slug is already in use", 409, "BUSINESS_SLUG_ALREADY_EXISTS");
    }
  }

  const vendor = await vendorRepository.updateByUserId(userId, sanitizedData);
  if (!vendor) {
    throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
  }

  return vendor;
};

const listVendors = async (query = {}) => {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    activity,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const filter = {};
  if (query.includeDeleted !== "true") {
    filter.deletedAt = null;
  }

  if (status && status !== "all") {
    filter.onboardingStatus = status;
  }

  if (activity === "has_products") {
    const activeVendorIdsWithProducts = await Product.distinct("vendorId", { deletedAt: null });
    filter._id = { $in: activeVendorIdsWithProducts };
  } else if (activity === "has_orders") {
    const vendorIdsWithOrders = await Order.distinct("items.vendorId");
    filter._id = { $in: vendorIdsWithOrders };
  }

  if (search && search.trim()) {
    const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sanitizedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(sanitizedSearch, "i");
    const matchingUsers = await User.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ],
    }).select("_id").lean();

    const matchingUserIds = matchingUsers.map((u) => u._id);

    filter.$or = [
      { businessName: searchRegex },
      { businessSlug: searchRegex },
      { supportEmail: searchRegex },
      { phone: searchRegex },
      { userId: { $in: matchingUserIds } },
    ];
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const total = await Vendor.countDocuments(filter);

  const sortMap = {
    createdAt: "createdAt",
    businessName: "businessName",
    storeName: "businessName",
    onboardingStatus: "onboardingStatus",
    approvedAt: "approvedAt",
  };
  const sortField = sortMap[sortBy] || "createdAt";
  const sortDirection = sortOrder === "asc" ? 1 : -1;

  const vendors = await Vendor.find(filter)
    .sort({ [sortField]: sortDirection })
    .skip(skip)
    .limit(safeLimit)
    .populate("userId", "firstName lastName email phone avatar role roles isActive isEmailVerified createdAt")
    .populate("approvedBy", "firstName lastName email")
    .populate("rejectedBy", "firstName lastName email")
    .populate("changesRequestedBy", "firstName lastName email")
    .lean();

  const vendorIds = vendors.map((v) => v._id);

  const [productCounts, orderCounts] = await Promise.all([
    Product.aggregate([
      { $match: { vendorId: { $in: vendorIds }, deletedAt: null } },
      { $group: { _id: "$vendorId", count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { "items.vendorId": { $in: vendorIds } } },
      { $unwind: "$items" },
      { $match: { "items.vendorId": { $in: vendorIds } } },
      { $group: { _id: { vendorId: "$items.vendorId", orderId: "$_id" } } },
      { $group: { _id: "$_id.vendorId", count: { $sum: 1 } } },
    ]),
  ]);

  const productCountMap = new Map(productCounts.map((p) => [p._id.toString(), p.count]));
  const orderCountMap = new Map(orderCounts.map((o) => [o._id.toString(), o.count]));

  const mappedVendors = vendors.map((v) => {
    const user = v.userId && typeof v.userId === "object" ? {
      ...v.userId,
      name: `${v.userId.firstName || ""} ${v.userId.lastName || ""}`.trim(),
    } : v.userId;

    const rawComm = v.commissionRate != null ? Number(v.commissionRate.toString()) : 0;
    const safeCommission = Number.isFinite(rawComm) ? rawComm : 0;

    return {
      ...v,
      commissionRate: safeCommission,
      userId: user,
      user,
      slug: v.businessSlug,
      gstin: v.taxInformation?.taxId || null,
      taxId: v.taxInformation?.taxId || null,
      secureId: encodeSecureId("vendor", v._id),
      productsCount: productCountMap.get(v._id.toString()) || 0,
      ordersCount: orderCountMap.get(v._id.toString()) || 0,
    };
  });

  const rawStatusCounts = await Vendor.aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: "$onboardingStatus", count: { $sum: 1 } } },
  ]);
  const statusCounts = {
    pending: 0,
    changes_requested: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
    inactive: 0,
    total: 0,
  };
  for (const sc of rawStatusCounts) {
    if (sc._id && statusCounts[sc._id] !== undefined) {
      statusCounts[sc._id] = sc.count;
    }
    statusCounts.total += sc.count;
  }

  return {
    vendors: mappedVendors,
    statusCounts,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
      statusCounts,
    },
  };
};

const getVendorById = async (vendorId) => {
  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });

  const vendor = await Vendor.findById(resolvedId)
    .populate("userId", "firstName lastName email phone avatar role roles isActive isEmailVerified createdAt")
    .populate("approvedBy", "firstName lastName email")
    .populate("rejectedBy", "firstName lastName email")
    .populate("changesRequestedBy", "firstName lastName email");

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  const [productsCount, ordersCount] = await Promise.all([
    Product.countDocuments({ vendorId: vendor._id, deletedAt: null }),
    Order.countDocuments({ "items.vendorId": vendor._id }),
  ]);

  const vendorObj = vendor.toObject();
  vendorObj.secureId = encodeSecureId("vendor", vendor._id);
  vendorObj.slug = vendorObj.businessSlug;
  vendorObj.gstin = vendorObj.taxInformation?.taxId || null;
  vendorObj.taxId = vendorObj.taxInformation?.taxId || null;
  if (vendorObj.userId && typeof vendorObj.userId === "object") {
    vendorObj.userId.name = `${vendorObj.userId.firstName || ""} ${vendorObj.userId.lastName || ""}`.trim();
    vendorObj.user = vendorObj.userId;
    vendorObj.email = vendorObj.email || vendorObj.supportEmail || vendorObj.userId.email || null;
    vendorObj.phone = vendorObj.phone || vendorObj.supportPhone || vendorObj.userId.phone || null;
  } else {
    vendorObj.email = vendorObj.email || vendorObj.supportEmail || null;
  }
  vendorObj.productsCount = productsCount;
  vendorObj.ordersCount = ordersCount;

  const rawComm = vendorObj.commissionRate != null ? Number(vendorObj.commissionRate.toString()) : 0;
  vendorObj.commissionRate = Number.isFinite(rawComm) ? rawComm : 0;

  // Resolve authoritative CommissionPolicy
  let effectiveCommission = null;
  try {
    const { resolveCommissionPolicy } = require("./commission.service");
    const resolved = await resolveCommissionPolicy({ vendorId: vendor._id });
    if (resolved) {
      effectiveCommission = {
        ...resolved,
        rate: resolved.rate != null ? Number(resolved.rate.toString()) : 0,
        percentage: resolved.percentage != null ? Number(resolved.percentage.toString()) : (resolved.rate ? Number(resolved.rate.toString()) * 100 : 0),
      };
    }
  } catch (err) {
    logger.warn(`Failed to resolve commission policy for vendor ${vendor._id}:`, err);
  }
  vendorObj.effectiveCommission = effectiveCommission;

  return vendorObj;
};

const approveVendor = async ({ vendorId, approvedBy, req }) => {
  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });

  const session = await mongoose.startSession();
  let updatedVendor = null;
  let beforeState = null;
  let isAlreadyApproved = false;

  try {
    await session.withTransaction(async () => {
      const vendor = await Vendor.findById(resolvedId).session(session);
      if (!vendor) {
        throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
      }

      // Idempotency: If already approved and active, return without error or duplicate email
      if (vendor.onboardingStatus === "approved" && vendor.isActive === true) {
        isAlreadyApproved = true;
        updatedVendor = vendor;
        return;
      }

      if (vendor.onboardingStatus === "suspended") {
        throw new AppError(
          "Cannot approve a suspended vendor. Review or reinstate account first.",
          400,
          "INVALID_STATE_TRANSITION"
        );
      }

      beforeState = vendor.toObject();

      vendor.onboardingStatus = "approved";
      vendor.isActive = true;
      vendor.approvedAt = new Date();
      vendor.approvedBy = approvedBy;
      vendor.rejectionReason = null;
      vendor.changesRequestedReason = null;

      await vendor.save({ session });

      // Ensure associated user record is active
      await User.updateOne({ _id: vendor.userId }, { isActive: true }).session(session);

      await recordAuditLog({
        actorId: approvedBy,
        targetId: vendor._id,
        action: "VENDOR_APPROVED",
        entityType: "Vendor",
        beforeState,
        afterState: vendor.toObject(),
        req,
        session,
      });

      updatedVendor = vendor;
    });
  } finally {
    await session.endSession();
  }

  // Post-commit notification (only dispatched when newly approved)
  if (!isAlreadyApproved && updatedVendor) {
    try {
      const user = await User.findById(updatedVendor.userId).lean();
      if (user?.email) {
        const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/vendor/dashboard`;
        const vendorName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || updatedVendor.businessName;
        await emailService.sendVendorApprovedEmail({
          to: user.email,
          vendorName,
          storeName: updatedVendor.businessName,
          dashboardUrl,
        });
      }
    } catch (err) {
      logger.warn(`Failed to dispatch vendor approved email: ${err.message}`);
    }
  }

  const result = updatedVendor.toObject ? updatedVendor.toObject() : updatedVendor;
  result.secureId = encodeSecureId("vendor", result._id);
  return result;
};

const verifyVendorEmailByAdmin = async ({ vendorId, adminId, req }) => {
  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });

  const session = await mongoose.startSession();
  let updatedVendor = null;

  try {
    await session.withTransaction(async () => {
      const vendor = await Vendor.findOne({ _id: resolvedId, deletedAt: null }).session(session);
      if (!vendor) {
        throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
      }

      const user = await User.findById(vendor.userId).session(session);
      if (!user) {
        throw new AppError("Associated user account not found", 404, "USER_NOT_FOUND");
      }

      if (user.isEmailVerified) {
        throw new AppError("Vendor email address is already verified.", 400, "EMAIL_ALREADY_VERIFIED");
      }

      const beforeState = { isEmailVerified: false };
      user.isEmailVerified = true;
      await user.save({ session });

      await recordAuditLog({
        actorId: adminId,
        targetId: vendor._id,
        action: "VENDOR_EMAIL_VERIFIED_BY_ADMIN",
        entityType: "Vendor",
        beforeState,
        afterState: { isEmailVerified: true },
        req,
        session,
      });

      updatedVendor = vendor;
    });
  } finally {
    await session.endSession();
  }

  const result = updatedVendor.toObject ? updatedVendor.toObject() : updatedVendor;
  result.secureId = encodeSecureId("vendor", result._id);
  return result;
};

const rejectVendor = async ({ vendorId, rejectedBy, reason, req }) => {
  if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
    throw new AppError("A specific rejection reason is required (minimum 5 characters)", 400, "VALIDATION_ERROR");
  }

  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });

  const session = await mongoose.startSession();
  let updatedVendor = null;
  let beforeState = null;
  let isAlreadyRejected = false;

  try {
    await session.withTransaction(async () => {
      const vendor = await Vendor.findOne({ _id: resolvedId, deletedAt: null }).session(session);
      if (!vendor) {
        throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
      }

      if (vendor.onboardingStatus === "approved") {
        throw new AppError(
          "Cannot reject an already approved vendor. Use account suspension for active merchants.",
          400,
          "INVALID_STATE_TRANSITION"
        );
      }

      // Idempotency: If already rejected with the exact same reason
      if (vendor.onboardingStatus === "rejected" && vendor.rejectionReason === reason.trim()) {
        isAlreadyRejected = true;
        updatedVendor = vendor;
        return;
      }

      beforeState = vendor.toObject();

      vendor.onboardingStatus = "rejected";
      vendor.isActive = false;
      vendor.rejectedAt = new Date();
      vendor.rejectedBy = rejectedBy;
      vendor.rejectionReason = reason.trim();

      await vendor.save({ session });

      await recordAuditLog({
        actorId: rejectedBy,
        targetId: vendor._id,
        action: "VENDOR_REJECTED",
        entityType: "Vendor",
        beforeState,
        afterState: vendor.toObject(),
        req,
        session,
      });

      updatedVendor = vendor;
    });
  } finally {
    await session.endSession();
  }

  // Post-commit notification (only if state changed)
  if (!isAlreadyRejected && updatedVendor) {
    try {
      const user = await User.findById(updatedVendor.userId).lean();
      if (user?.email) {
        const vendorName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || updatedVendor.businessName;
        await emailService.sendVendorRejectedEmail({
          to: user.email,
          vendorName,
          storeName: updatedVendor.businessName,
          reason: reason.trim(),
        });
      }
    } catch (err) {
      logger.warn(`Failed to dispatch vendor rejected email: ${err.message}`);
    }
  }

  const result = updatedVendor.toObject ? updatedVendor.toObject() : updatedVendor;
  result.secureId = encodeSecureId("vendor", result._id);
  return result;
};

const requestChanges = async ({ vendorId, requestedBy, reason, req }) => {
  if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
    throw new AppError("Clear instructions for requested changes are required (minimum 5 characters)", 400, "VALIDATION_ERROR");
  }

  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });

  const session = await mongoose.startSession();
  let updatedVendor = null;
  let beforeState = null;

  try {
    await session.withTransaction(async () => {
      const vendor = await Vendor.findOne({ _id: resolvedId, deletedAt: null }).session(session);
      if (!vendor) {
        throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
      }

      if (vendor.onboardingStatus === "approved") {
        throw new AppError(
          "Cannot request onboarding changes for an approved active vendor.",
          400,
          "INVALID_STATE_TRANSITION"
        );
      }

      beforeState = vendor.toObject();

      vendor.onboardingStatus = "changes_requested";
      vendor.isActive = false;
      vendor.changesRequestedAt = new Date();
      vendor.changesRequestedBy = requestedBy;
      vendor.changesRequestedReason = reason.trim();

      await vendor.save({ session });

      await recordAuditLog({
        actorId: requestedBy,
        targetId: vendor._id,
        action: "VENDOR_CHANGES_REQUESTED",
        entityType: "Vendor",
        beforeState,
        afterState: vendor.toObject(),
        req,
        session,
      });

      updatedVendor = vendor;
    });
  } finally {
    await session.endSession();
  }

  // Post-commit notification
  if (updatedVendor) {
    try {
      const user = await User.findById(updatedVendor.userId).lean();
      if (user?.email) {
        const portalUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/vendor/store`;
        const vendorName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || updatedVendor.businessName;
        await emailService.sendVendorChangesRequestedEmail({
          to: user.email,
          vendorName,
          storeName: updatedVendor.businessName,
          reason: reason.trim(),
          portalUrl,
        });
      }
    } catch (err) {
      logger.warn(`Failed to dispatch vendor changes requested email: ${err.message}`);
    }
  }

  const result = updatedVendor.toObject ? updatedVendor.toObject() : updatedVendor;
  result.secureId = encodeSecureId("vendor", result._id);
  return result;
};

const resubmitVendorApplication = async ({ userId, req }) => {
  const vendor = await Vendor.findOne({ userId, deletedAt: null });
  if (!vendor) {
    throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
  }

  if (vendor.onboardingStatus === "approved") {
    throw new AppError("Vendor application is already approved", 400, "ALREADY_APPROVED");
  }

  if (vendor.onboardingStatus === "pending") {
    throw new AppError("Vendor application is already pending review", 400, "ALREADY_PENDING");
  }

  if (vendor.onboardingStatus !== "changes_requested" && vendor.onboardingStatus !== "rejected") {
    throw new AppError(
      `Cannot resubmit application from current status: ${vendor.onboardingStatus}`,
      400,
      "INVALID_STATE_TRANSITION"
    );
  }

  const session = await mongoose.startSession();
  let updatedVendor = null;

  try {
    await session.withTransaction(async () => {
      const v = await Vendor.findById(vendor._id).session(session);
      const beforeState = v.toObject();

      v.onboardingStatus = "pending";
      v.isActive = false;
      await v.save({ session });

      await recordAuditLog({
        actorId: userId,
        targetId: v._id,
        action: "VENDOR_APPLICATION_RESUBMITTED",
        entityType: "Vendor",
        beforeState,
        afterState: v.toObject(),
        req,
        session,
      });

      updatedVendor = v;
    });
  } finally {
    await session.endSession();
  }

  const result = updatedVendor.toObject ? updatedVendor.toObject() : updatedVendor;
  result.secureId = encodeSecureId("vendor", result._id);
  return result;
};

const updateVendorStatus = async (
  vendorId,
  onboardingStatus,
  extraData = {},
  options = {}
) => {
  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });
  const vendor = await Vendor.findOne({ _id: resolvedId, deletedAt: null });

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  const beforeState = vendor.toObject();

  vendor.onboardingStatus = onboardingStatus;
  if (extraData.isActive !== undefined) {
    vendor.isActive = extraData.isActive;
  }
  if (extraData.rejectionReason !== undefined) {
    vendor.rejectionReason = extraData.rejectionReason;
  }
  if (extraData.changesRequestedReason !== undefined) {
    vendor.changesRequestedReason = extraData.changesRequestedReason;
  }

  // If vendor is suspended or rejected, ensure isActive is false
  if (onboardingStatus === "suspended" || onboardingStatus === "rejected") {
    vendor.isActive = false;
  } else if (onboardingStatus === "approved" && extraData.isActive !== false) {
    vendor.isActive = true;
  }

  await vendor.save();

  // Synchronize associated user account status and immediately invalidate sessions
  if (vendor.userId) {
    const isUserActive = vendor.isActive && vendor.onboardingStatus === "approved" && !vendor.deletedAt;
    await User.updateOne(
      { _id: vendor.userId },
      {
        isActive: isUserActive,
        $inc: { authVersion: 1 },
      }
    );
    if (!isUserActive) {
      await RefreshToken.updateMany(
        { userId: vendor.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
  }

  // Synchronize product store visibility
  const isStoreVisible = vendor.isActive && vendor.onboardingStatus === "approved" && !vendor.deletedAt;
  if (isStoreVisible) {
    await Product.updateMany(
      { vendorId: vendor._id, status: "active", deletedAt: null },
      { $set: { isStoreVisible: true } }
    );
  } else {
    await Product.updateMany(
      { vendorId: vendor._id, deletedAt: null },
      { $set: { isStoreVisible: false } }
    );
  }

  if (options.actorId) {
    const reason = options.reason || extraData.reason || extraData.rejectionReason || extraData.changesRequestedReason || null;
    await recordAuditLog({
      actorId: options.actorId,
      targetId: vendor._id,
      action: `VENDOR_STATUS_UPDATED_${onboardingStatus.toUpperCase()}`,
      entityType: "Vendor",
      beforeState,
      afterState: { ...vendor.toObject(), reason },
      reason,
      req: options.req || null,
    });
  }

  const result = vendor.toObject();
  result.secureId = encodeSecureId("vendor", result._id);
  return result;
};

const getVendorDashboardAnalytics = async ({ vendorId, range = "30d" }) => {
  const vendorObjId = new mongoose.Types.ObjectId(vendorId);

  // 1. Products and variants count
  const vendorProducts = await Product.find({
    vendorId: vendorObjId,
    deletedAt: null,
  })
    .select("_id name title status price sku")
    .lean();

  const productIds = vendorProducts.map((p) => p._id);
  const totalProducts = vendorProducts.length;
  const activeProductsCount = vendorProducts.filter((p) => p.status === "active").length;

  // 2. Inventory & Low Stock
  let lowStockCount = 0;
  let totalStockOnHand = 0;
  const lowStockAlerts = [];

  if (productIds.length > 0) {
    const variants = await ProductVariant.find({
      productId: { $in: productIds },
    })
      .select("_id productId sku price")
      .lean();

    const variantIds = variants.map((v) => v._id);
    const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));
    const productMap = new Map(vendorProducts.map((p) => [p._id.toString(), p]));

    const inventories = await Inventory.find({
      productVariantId: { $in: variantIds },
    }).lean();

    for (const inv of inventories) {
      const available = (inv.onHand || 0) - (inv.reserved || 0);
      totalStockOnHand += inv.onHand || 0;
      if (available <= (inv.lowStockThreshold || 5)) {
        lowStockCount++;
        const variant = variantMap.get(inv.productVariantId.toString());
        const product = variant ? productMap.get(variant.productId?.toString()) : null;
        if (lowStockAlerts.length < 5) {
          lowStockAlerts.push({
            inventoryId: inv._id,
            secureId: encodeSecureId("inventory", inv._id),
            sku: variant?.sku || "N/A",
            productTitle: product?.name || product?.title || "Product",
            available,
            onHand: inv.onHand || 0,
            threshold: inv.lowStockThreshold || 5,
          });
        }
      }
    }
  }

  // 3. Orders analytics (optimized DB aggregations replacing full-table memory loading)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Time range filtering for trends
  let rangeStartDate = new Date();
  if (range === "today") {
    rangeStartDate = new Date(startOfToday);
  } else if (range === "7d") {
    rangeStartDate.setDate(rangeStartDate.getDate() - 7);
  } else if (range === "90d") {
    rangeStartDate.setDate(rangeStartDate.getDate() - 90);
  } else {
    // default 30d
    rangeStartDate.setDate(rangeStartDate.getDate() - 30);
  }

  const salesTrendMap = new Map();
  const daysDiff = Math.ceil((Date.now() - rangeStartDate.getTime()) / (1000 * 60 * 60 * 24));
  for (let i = 0; i <= Math.min(daysDiff, 90); i++) {
    const d = new Date(rangeStartDate);
    d.setDate(d.getDate() + i);
    const dateKey = d.toISOString().slice(0, 10);
    salesTrendMap.set(dateKey, { date: dateKey, sales: 0, orders: 0, units: 0 });
  }

  const [
    totalOrdersCount,
    pendingOrdersCount,
    totalSalesAgg,
    todaySalesAgg,
    trendAgg,
    recentOrdersDocs,
  ] = await Promise.all([
    Order.countDocuments({ "items.vendorId": vendorObjId }),
    Order.countDocuments({
      "items.vendorId": vendorObjId,
      status: { $in: ["pending_payment", "confirmed", "processing", "packed"] },
      fulfillmentStatus: { $ne: "fulfilled" },
    }),
    Order.aggregate([
      {
        $match: {
          "items.vendorId": vendorObjId,
          status: { $nin: ["cancelled", "expired"] },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.vendorId": vendorObjId } },
      {
        $group: {
          _id: null,
          totalGrossSalesMinor: {
            $sum: {
              $round: [{ $multiply: [{ $toDouble: "$items.lineTotal" }, 100] }, 0],
            },
          },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          "items.vendorId": vendorObjId,
          status: { $nin: ["cancelled", "expired"] },
          createdAt: { $gte: startOfToday },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.vendorId": vendorObjId } },
      {
        $group: {
          _id: null,
          todaySalesMinor: {
            $sum: {
              $round: [{ $multiply: [{ $toDouble: "$items.lineTotal" }, 100] }, 0],
            },
          },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          "items.vendorId": vendorObjId,
          status: { $nin: ["cancelled", "expired"] },
          createdAt: { $gte: rangeStartDate },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.vendorId": vendorObjId } },
      {
        $group: {
          _id: {
            dateKey: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            orderId: "$_id",
          },
          orderItemSales: { $sum: { $toDouble: "$items.lineTotal" } },
          orderItemUnits: { $sum: { $ifNull: ["$items.quantity", 1] } },
        },
      },
      {
        $group: {
          _id: "$_id.dateKey",
          sales: { $sum: "$orderItemSales" },
          orders: { $sum: 1 },
          units: { $sum: "$orderItemUnits" },
        },
      },
    ]),
    Order.find({
      "items.vendorId": vendorObjId,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const totalGrossSalesMinor = totalSalesAgg[0]?.totalGrossSalesMinor || 0;
  const todaySalesMinor = todaySalesAgg[0]?.todaySalesMinor || 0;

  for (const item of trendAgg) {
    if (salesTrendMap.has(item._id)) {
      const bucket = salesTrendMap.get(item._id);
      bucket.sales = Number((item.sales || 0).toFixed(2));
      bucket.orders = item.orders || 0;
      bucket.units = item.units || 0;
    }
  }

  const salesTrends = Array.from(salesTrendMap.values()).map((b) => ({
    date: b.date,
    sales: Number(b.sales.toFixed(2)),
    orders: b.orders,
    units: b.units,
  }));

  // 4. Returns analytics
  let pendingReturnsCount = 0;
  let recentReturns = [];
  if (productIds.length > 0) {
    const returns = await ReturnRequest.find({
      "items.productId": { $in: productIds },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    pendingReturnsCount = returns.filter((r) =>
      ["requested", "approved", "pickup_scheduled"].includes(r.status)
    ).length;

    recentReturns = returns.slice(0, 5).map((r) => ({
      _id: r._id,
      secureId: encodeSecureId("return", r._id),
      returnNumber: r.returnNumber,
      status: r.status,
      type: r.type,
      createdAt: r.createdAt,
    }));
  }

  // 5. Settlements analytics
  const settlements = await VendorSettlement.find({
    vendorId: vendorObjId,
  })
    .sort({ createdAt: -1 })
    .lean();

  let pendingSettlementMinor = 0;
  let pendingSettlementsCount = 0;

  for (const stl of settlements) {
    if (["pending", "processing"].includes(stl.status)) {
      pendingSettlementsCount++;
      const netPayable = Number(stl.netPayable?.toString() || 0);
      pendingSettlementMinor += Math.round(netPayable * 100);
    }
  }

  // 6. Recent Orders (top 5, projected to this vendor)
  const recentOrders = recentOrdersDocs.map((order) => {
    const projected = projectVendorOrder(order, vendorObjId);
    return {
      ...projected,
      secureId: encodeSecureId("order", order._id),
    };
  });

  // 7. Dynamic actionable alerts
  const alerts = [];
  if (lowStockCount > 0) {
    alerts.push({
      type: "warning",
      title: "Low Stock Warning",
      message: `${lowStockCount} product variant${lowStockCount > 1 ? "s are" : " is"} running low on inventory.`,
      actionUrl: "/vendor/inventory",
      actionLabel: "Restock Now",
    });
  }
  if (pendingOrdersCount > 0) {
    alerts.push({
      type: "info",
      title: "Orders Pending Fulfillment",
      message: `You have ${pendingOrdersCount} customer order${pendingOrdersCount > 1 ? "s" : ""} waiting to be fulfilled.`,
      actionUrl: "/vendor/orders",
      actionLabel: "View Orders",
    });
  }
  if (pendingReturnsCount > 0) {
    alerts.push({
      type: "warning",
      title: "Pending Return Requests",
      message: `${pendingReturnsCount} return request${pendingReturnsCount > 1 ? "s require" : " requires"} merchant inspection.`,
      actionUrl: "/vendor/returns",
      actionLabel: "Review Returns",
    });
  }

  return {
    metrics: {
      totalSales: (totalGrossSalesMinor / 100).toFixed(2),
      todaySales: (todaySalesMinor / 100).toFixed(2),
      ordersCount: totalOrdersCount,
      pendingOrdersCount,
      productsCount: totalProducts,
      activeProductsCount,
      lowStockCount,
      pendingReturnsCount,
      pendingSettlementsCount,
      pendingSettlementAmount: (pendingSettlementMinor / 100).toFixed(2),
      totalStockOnHand,
    },
    salesTrends,
    recentOrders,
    alerts,
    lowStockAlerts,
    recentReturns,
  };
};

const getVendorActivityLogs = async ({ userId }) => {
  const logs = await AuditLog.find({
    actorId: userId,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return logs.map((log) => ({
    _id: log._id,
    action: log.action,
    entityType: log.entityType,
    targetId: log.targetId,
    beforeState: log.beforeState,
    afterState: log.afterState,
    createdAt: log.createdAt,
  }));
};

const getVendorOverview = async (vendorId) => {
  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });
  const vendor = await Vendor.findOne({ _id: resolvedId, deletedAt: null })
    .populate("userId", "firstName lastName email phone avatar role roles isActive lastLoginAt createdAt")
    .populate("approvedBy", "firstName lastName email")
    .lean();

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  vendor.secureId = encodeSecureId("vendor", vendor._id);
  const vendorObjId = vendor._id;

  const rawComm = vendor.commissionRate != null ? Number(vendor.commissionRate.toString()) : 0;
  vendor.commissionRate = Number.isFinite(rawComm) ? rawComm : 0;

  let effectiveCommission = null;
  try {
    const { resolveCommissionPolicy } = require("./commission.service");
    const resolved = await resolveCommissionPolicy({ vendorId: vendor._id });
    if (resolved) {
      effectiveCommission = {
        ...resolved,
        rate: resolved.rate != null ? Number(resolved.rate.toString()) : 0,
        percentage: resolved.percentage != null ? Number(resolved.percentage.toString()) : (resolved.rate ? Number(resolved.rate.toString()) * 100 : 0),
      };
    }
  } catch (err) {
    logger.warn(`Failed to resolve commission policy for vendor overview ${vendor._id}:`, err);
  }
  vendor.effectiveCommission = effectiveCommission;

  // 1. Products
  const vendorProducts = await Product.find({
    vendorId: vendorObjId,
    deletedAt: null,
  })
    .select("_id name slug status price sku ratingAverage ratingCount stockStatus createdAt")
    .lean();

  const productIds = vendorProducts.map((p) => p._id);
  const totalProducts = vendorProducts.length;
  const activeProducts = vendorProducts.filter((p) => p.status === "active").length;
  const pendingProducts = vendorProducts.filter((p) =>
    ["pending_approval", "draft", "under_review"].includes(p.status)
  ).length;

  // 2. Variants and Inventory Value
  let inventoryValue = 0;
  let lowStockCount = 0;
  let totalStockOnHand = 0;

  if (productIds.length > 0) {
    const variants = await ProductVariant.find({ productId: { $in: productIds } })
      .select("_id productId sku price")
      .lean();
    const variantPriceMap = new Map(
      variants.map((v) => [v._id.toString(), Number(v.price?.toString() || 0)])
    );

    const inventories = await Inventory.find({
      productVariantId: { $in: variants.map((v) => v._id) },
    }).lean();

    for (const inv of inventories) {
      const onHand = inv.onHand || 0;
      const reserved = inv.reserved || 0;
      const available = Math.max(0, onHand - reserved);
      totalStockOnHand += onHand;
      const price = variantPriceMap.get(inv.productVariantId?.toString()) || 0;
      inventoryValue += available * price;
      if (available <= (inv.lowStockThreshold || 5)) {
        lowStockCount++;
      }
    }
  }

  // 3. Orders & Financial Aggregation Pipeline (Database-side to prevent heap exhaustion)
  const orderStatsAgg = await Order.aggregate([
    { $match: { "items.vendorId": vendorObjId } },
    {
      $facet: {
        totalAndCancelled: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              cancelledOrders: {
                $sum: {
                  $cond: [{ $in: ["$status", ["cancelled", "expired"]] }, 1, 0],
                },
              },
            },
          },
        ],
        grossSales: [
          { $match: { status: { $nin: ["cancelled", "expired"] } } },
          { $unwind: "$items" },
          { $match: { "items.vendorId": vendorObjId } },
          {
            $group: {
              _id: null,
              totalGross: { $sum: { $toDouble: "$items.lineTotal" } },
            },
          },
        ],
        paidSales: [
          {
            $match: {
              paymentStatus: "paid",
              status: { $nin: ["cancelled", "expired"] },
            },
          },
          { $unwind: "$items" },
          { $match: { "items.vendorId": vendorObjId } },
          {
            $group: {
              _id: null,
              totalPaid: { $sum: { $toDouble: "$items.lineTotal" } },
            },
          },
        ],
        deliveredSales: [
          { $match: { status: "delivered" } },
          { $unwind: "$items" },
          { $match: { "items.vendorId": vendorObjId } },
          {
            $group: {
              _id: null,
              totalDelivered: { $sum: { $toDouble: "$items.lineTotal" } },
            },
          },
        ],
      },
    },
  ]);

  const facet = orderStatsAgg[0] || {};
  const totalOrders = facet.totalAndCancelled?.[0]?.totalOrders || 0;
  const cancelledOrders = facet.totalAndCancelled?.[0]?.cancelledOrders || 0;
  const totalGrossSales = facet.grossSales?.[0]?.totalGross || 0;
  const paidSales = facet.paidSales?.[0]?.totalPaid || 0;
  const deliveredSales = facet.deliveredSales?.[0]?.totalDelivered || 0;

  // 4. Shipments
  const Shipment = require("../models/Shipment");
  const [totalShipments, fulfilledShipments] = await Promise.all([
    Shipment.countDocuments({ vendorId: vendorObjId }),
    Shipment.countDocuments({
      vendorId: vendorObjId,
      status: { $in: ["delivered", "in_transit", "out_for_delivery"] },
    }),
  ]);

  // 5. Settlements / Pending Earnings
  const VendorSettlementModel =
    require("../models/VendorSettlement").VendorSettlement ||
    require("../models/VendorSettlement");
  const settlements = await VendorSettlementModel.find({ vendorId: vendorObjId }).lean();
  let pendingEarningsMinor = 0;
  for (const stl of settlements) {
    if (["pending", "processing"].includes(stl.status)) {
      pendingEarningsMinor += Math.round(Number(stl.netPayable?.toString() || 0) * 100);
    }
  }

  // 6. Returns / Refunds
  let returnRefundCount = 0;
  if (productIds.length > 0) {
    returnRefundCount = await ReturnRequest.countDocuments({
      "items.productId": { $in: productIds },
    });
  }

  // 7. Store Rating
  const Review = require("../models/Review");
  let storeRating = 5.0;
  if (productIds.length > 0) {
    const ratingAgg = await Review.aggregate([
      { $match: { productId: { $in: productIds } } },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } },
    ]);
    if (ratingAgg.length > 0 && ratingAgg[0].avgRating) {
      storeRating = Number(ratingAgg[0].avgRating.toFixed(1));
    } else {
      const ratedProducts = vendorProducts.filter((p) => p.ratingAverage > 0);
      if (ratedProducts.length > 0) {
        const sum = ratedProducts.reduce((acc, p) => acc + (p.ratingAverage || 0), 0);
        storeRating = Number((sum / ratedProducts.length).toFixed(1));
      }
    }
  }

  const kpis = {
    totalProducts,
    activeProducts,
    pendingProducts,
    totalOrders,
    totalEarnings: Number(totalGrossSales.toFixed(2)),
    pendingEarnings: Number((pendingEarningsMinor / 100).toFixed(2)),
    totalShipments,
    fulfilledShipments,
    cancelledOrders,
    returnRefundCount,
    inventoryValue: Number(inventoryValue.toFixed(2)),
    storeRating,
    lowStockCount,
    totalStockOnHand,
  };

  // Bounded recent orders query (max 25)
  const recentOrdersRaw = await Order.find({ "items.vendorId": vendorObjId })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  const recentOrders = recentOrdersRaw.map((order) => {
    const projected = projectVendorOrder(order, vendorObjId);
    return {
      ...projected,
      secureId: encodeSecureId("order", order._id),
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      customerName: order.shippingAddress?.fullName || null,
      customerCity: order.shippingAddress?.city || null,
    };
  });

  // 8. Products with their variants
  const variantsByProduct = new Map();
  if (productIds.length > 0) {
    const allVariants = await ProductVariant.find({ productId: { $in: productIds } })
      .select("_id productId sku price attributes title stockStatus")
      .lean();
    for (const vr of allVariants) {
      const pId = vr.productId.toString();
      if (!variantsByProduct.has(pId)) {
        variantsByProduct.set(pId, []);
      }
      variantsByProduct.get(pId).push(vr);
    }
  }

  const enrichedProducts = vendorProducts.map((p) => ({
    ...p,
    variants: variantsByProduct.get(p._id.toString()) || [],
  }));

  // 9. Vendor Inventory & Warehouse locations
  require("../models/Warehouse");
  let inventoryItems = [];
  if (productIds.length > 0) {
    const allVariantIds = Array.from(variantsByProduct.values()).flat().map((v) => v._id);
    if (allVariantIds.length > 0) {
      inventoryItems = await Inventory.find({ productVariantId: { $in: allVariantIds } })
        .populate("warehouseId", "name code city state country isActive")
        .populate({
          path: "productVariantId",
          select: "sku variantName title price productId",
          populate: { path: "productId", select: "name slug" },
        })
        .lean();
    }
  }

  // 10. Audit History for this Vendor
  const auditLogs = await AuditLog.find({
    $or: [
      { targetId: vendorObjId },
      { actorId: vendor.userId?._id || vendor.userId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate("actorId", "firstName lastName email role")
    .lean();

  const formattedAuditLogs = auditLogs.map((log) => ({
    _id: log._id,
    action: log.action,
    entityType: log.entityType,
    actorEmail: log.actorId?.email || "System",
    actorName: log.actorId?.firstName ? `${log.actorId.firstName} ${log.actorId.lastName || ""}`.trim() : log.actorId?.role || "System",
    actorRole: log.actorId?.role || "system",
    beforeState: log.beforeState,
    afterState: log.afterState,
    createdAt: log.createdAt,
  }));

  // 11. Settlements
  const formattedSettlements = settlements.map((stl) => ({
    _id: stl._id,
    settlementNumber: stl.settlementNumber,
    periodStart: stl.periodStart,
    periodEnd: stl.periodEnd,
    grossSales: Number(stl.grossSales?.toString() || 0),
    platformCommission: Number(stl.platformCommission?.toString() || 0),
    netPayable: Number(stl.netPayable?.toString() || 0),
    status: stl.status,
    currency: stl.currency || "INR",
    payoutReference: stl.payoutReference,
    paidAt: stl.paidAt,
    createdAt: stl.createdAt,
  }));

  // 12. Wallet, Payouts, and Bank Accounts Integration
  const VendorWallet = require("../models/VendorWallet");
  const VendorPayout = require("../models/VendorPayout");
  const VendorBankAccount = require("../models/VendorBankAccount");

  const [wallet, rawPayouts, bankAccounts] = await Promise.all([
    VendorWallet.findOne({ vendorId: vendorObjId }).lean(),
    VendorPayout.find({ vendorId: vendorObjId })
      .sort({ createdAt: -1 })
      .limit(25)
      .populate("bankAccountId", "bankName accountNumberMasked accountHolderName")
      .lean(),
    VendorBankAccount.find({ vendorId: vendorObjId })
      .select("-accountNumberEncrypted")
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean(),
  ]);

  const payouts = rawPayouts.map((p) => ({
    _id: p._id,
    payoutNumber: p.payoutNumber,
    amount: Number(p.amount?.toString() || 0),
    currency: p.currency || "INR",
    status: p.status,
    provider: p.provider,
    providerReference: p.providerReference,
    bankName: p.bankAccountId?.bankName || null,
    accountNumberMasked: p.bankAccountId?.accountNumberMasked || null,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  }));

  const walletSummary = wallet ? {
    status: wallet.status,
    currency: wallet.currency || "INR",
    availableBalance: Number(wallet.availableBalance?.toString() || 0),
    pendingBalance: Number(wallet.pendingBalance?.toString() || 0),
    reservedBalance: Number(wallet.reservedBalance?.toString() || 0),
    totalEarned: Number(wallet.totalEarned?.toString() || 0),
    totalWithdrawn: Number(wallet.totalWithdrawn?.toString() || 0),
  } : null;

  const financial = {
    grossSales: Number(totalGrossSales.toFixed(2)),
    paidSales: Number(paidSales.toFixed(2)),
    deliveredSales: Number(deliveredSales.toFixed(2)),
    pendingEarnings: Number((pendingEarningsMinor / 100).toFixed(2)),
    wallet: walletSummary,
    profit: null,
    profitUnavailableReason: "Cost of Goods Sold (COGS) tracking is unpopulated on product variants and un-snapshotted on order items.",
  };

  return {
    vendor,
    kpis,
    financial,
    wallet: walletSummary,
    payouts,
    bankAccounts,
    recentOrders,
    products: enrichedProducts,
    inventory: inventoryItems,
    settlements: formattedSettlements,
    auditLogs: formattedAuditLogs,
  };
};

const updateVendorAdmin = async (vendorId, payload, options = {}) => {
  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });
  const vendor = await Vendor.findOne({ _id: resolvedId, deletedAt: null });

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  const beforeState = vendor.toObject();

  if (payload.businessName) vendor.businessName = payload.businessName.trim();
  if (payload.phone !== undefined) vendor.phone = payload.phone?.trim() || null;
  if (payload.supportEmail !== undefined)
    vendor.supportEmail = payload.supportEmail?.trim()?.toLowerCase() || null;
  if (payload.commissionRate !== undefined) vendor.commissionRate = payload.commissionRate;
  if (payload.isActive !== undefined) vendor.isActive = Boolean(payload.isActive);
  if (payload.onboardingStatus) vendor.onboardingStatus = payload.onboardingStatus;
  if (payload.businessAddress) {
    vendor.businessAddress = {
      ...(vendor.businessAddress?.toObject?.() || {}),
      ...payload.businessAddress,
    };
  }
  if (payload.taxInformation) {
    vendor.taxInformation = {
      ...(vendor.taxInformation?.toObject?.() || {}),
      ...payload.taxInformation,
    };
  }

  await vendor.save();

  // SA-02A: Synchronize vendor login eligibility with linked User record
  const isEligible = vendor.isActive && vendor.onboardingStatus === "approved" && !vendor.deletedAt;
  const statusChanged = payload.isActive !== undefined || payload.onboardingStatus !== undefined;

  if (statusChanged && vendor.userId) {
    if (!isEligible) {
      if (options.actorId && vendor.userId && String(options.actorId) === String(vendor.userId)) {
        throw new AppError("Administrators cannot deactivate their own linked vendor account", 400, "SELF_DELETION_FORBIDDEN");
      }
      await User.updateOne(
        { _id: vendor.userId },
        { isActive: false, $inc: { authVersion: 1 } }
      );
      await RefreshToken.updateMany(
        { userId: vendor.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      await Product.updateMany(
        { vendorId: vendor._id, deletedAt: null },
        { $set: { isStoreVisible: false } }
      );
    } else {
      await User.updateOne(
        { _id: vendor.userId },
        { isActive: true, deletedAt: null, $inc: { authVersion: 1 } }
      );
      await Product.updateMany(
        { vendorId: vendor._id, status: "active", deletedAt: null },
        { $set: { isStoreVisible: true } }
      );
    }
  }

  const reason = options.reason || payload.reason || "Administrative update";
  if (options.actorId) {
    await recordAuditLog({
      actorId: options.actorId,
      targetId: vendor._id,
      action: "VENDOR_UPDATED_BY_SUPERADMIN",
      entityType: "Vendor",
      reason: String(reason).trim(),
      beforeState,
      afterState: vendor.toObject(),
      req: options.req || null,
    });
  }

  const result = vendor.toObject();
  result.secureId = encodeSecureId("vendor", result._id);
  return result;
};

const suspendVendor = async (vendorId, { reason, actorId, req } = {}) => {
  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    throw new AppError("Administrative reason of at least 10 characters is required", 400, "INVALID_REASON");
  }

  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });
  const vendor = await Vendor.findOne({ _id: resolvedId, deletedAt: null });

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  if (actorId && vendor.userId && String(actorId) === String(vendor.userId)) {
    throw new AppError("Administrators cannot suspend their own linked vendor account", 400, "SELF_SUSPENSION_FORBIDDEN");
  }

  if (vendor.onboardingStatus === "suspended" || !vendor.isActive) {
    throw new AppError("Vendor is already suspended", 400, "VENDOR_ALREADY_SUSPENDED");
  }

  const beforeState = vendor.toObject();
  const trimmedReason = reason.trim();

  vendor.onboardingStatus = "suspended";
  vendor.isActive = false;
  vendor.suspensionReason = trimmedReason;
  await vendor.save();

  if (vendor.userId) {
    const linkedUser = await User.findById(vendor.userId);
    if (linkedUser) {
      const remainingRoles = (linkedUser.roles || []).filter((r) => r !== ROLES.VENDOR);
      const isMultiRole = remainingRoles.length > 0 && remainingRoles.includes(ROLES.CUSTOMER);
      if (isMultiRole) {
        await User.updateOne(
          { _id: linkedUser._id },
          { $inc: { authVersion: 1 } }
        );
      } else {
        await User.updateOne(
          { _id: linkedUser._id },
          { isActive: false, $inc: { authVersion: 1 } }
        );
      }
      await RefreshToken.updateMany(
        { userId: vendor.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
  }

  await Product.updateMany(
    { vendorId: vendor._id, deletedAt: null },
    { $set: { isStoreVisible: false, status: "inactive" } }
  );

  if (actorId) {
    await recordAuditLog({
      actorId,
      targetId: vendor._id,
      action: "vendor.suspended",
      entityType: "Vendor",
      reason: trimmedReason,
      beforeState,
      afterState: vendor.toObject(),
      req: req || null,
    });
  }

  const result = vendor.toObject();
  result.secureId = encodeSecureId("vendor", result._id);
  return {
    success: true,
    message: "Vendor suspended successfully and active sessions invalidated",
    vendor: result,
  };
};

const reactivateVendor = async (vendorId, { reason, actorId, req } = {}) => {
  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    throw new AppError("Administrative reason of at least 10 characters is required", 400, "INVALID_REASON");
  }

  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });
  const vendor = await Vendor.findById(resolvedId);

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  if (
    vendor.onboardingStatus === "pending" ||
    vendor.onboardingStatus === "under_review" ||
    vendor.onboardingStatus === "rejected" ||
    vendor.onboardingStatus === "changes_requested"
  ) {
    throw new AppError(
      `Cannot reactivate vendor with status "${vendor.onboardingStatus}". Applications must be processed through the onboarding workflow.`,
      400,
      "INVALID_TRANSITION"
    );
  }

  if (vendor.isActive && vendor.onboardingStatus === "approved" && !vendor.deletedAt) {
    throw new AppError("Vendor is already active", 400, "VENDOR_ALREADY_ACTIVE");
  }

  const beforeState = vendor.toObject();
  const trimmedReason = reason.trim();

  vendor.onboardingStatus = "approved";
  vendor.isActive = true;
  vendor.deletedAt = null;
  vendor.suspensionReason = null;
  await vendor.save();

  if (vendor.userId) {
    await User.updateOne(
      { _id: vendor.userId },
      { isActive: true, deletedAt: null, $inc: { authVersion: 1 } }
    );
  }

  await Product.updateMany(
    { vendorId: vendor._id, status: "active", deletedAt: null },
    { $set: { isStoreVisible: true } }
  );

  if (actorId) {
    await recordAuditLog({
      actorId,
      targetId: vendor._id,
      action: "vendor.reactivated",
      entityType: "Vendor",
      reason: trimmedReason,
      beforeState,
      afterState: vendor.toObject(),
      req: req || null,
    });
  }

  const result = vendor.toObject();
  result.secureId = encodeSecureId("vendor", result._id);
  return {
    success: true,
    message: "Vendor reactivated successfully",
    vendor: result,
  };
};

const resetVendorPassword = async (vendorId, newPassword, reason, actor, req = null) => {
  if (!actor || !["super_admin", "SUPER_ADMIN", "admin"].includes(actor.role)) {
    throw new AppError("Only Superadmin/Admin can reset vendor credentials", 403, "FORBIDDEN");
  }

  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    throw new AppError("Administrative reason of at least 10 characters is required", 400, "INVALID_REASON");
  }

  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });
  const vendor = await Vendor.findById(resolvedId);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  const user = await User.findById(vendor.userId);
  if (!user) {
    throw new AppError("Vendor user account not found", 404, "USER_NOT_FOUND");
  }

  const actorId = actor?._id || actor?.id;
  if (actorId && String(actorId) === String(user._id)) {
    throw new AppError("Administrators cannot use administrative vendor reset on their own account", 400, "SELF_PASSWORD_RESET_FORBIDDEN");
  }

  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;
  user.authVersion = (user.authVersion || 1) + 1;
  await user.save();

  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  await recordAuditLog({
    actorId,
    targetId: vendor._id,
    action: "vendor.password_reset",
    entityType: "Vendor",
    reason: reason.trim(),
    afterState: { vendorId: vendor._id, userId: user._id, resetAt: new Date() },
    req,
  });

  return { success: true, message: "Vendor account password updated securely and active sessions invalidated." };
};

const deleteVendor = async (vendorId, { reason, actorId, req } = {}) => {
  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    throw new AppError("Administrative reason of at least 10 characters is required", 400, "INVALID_REASON");
  }

  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });
  const vendor = await Vendor.findById(resolvedId);

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  if (vendor.deletedAt) {
    throw new AppError("Vendor account is already deactivated", 400, "VENDOR_ALREADY_DEACTIVATED");
  }

  if (actorId && String(actorId) === String(vendor.userId)) {
    throw new AppError("Administrators cannot deactivate their own linked vendor account", 400, "SELF_DELETION_FORBIDDEN");
  }

  const beforeState = vendor.toObject();
  const trimmedReason = reason.trim();
  const deletedAt = new Date();

  vendor.deletedAt = deletedAt;
  vendor.isActive = false;
  vendor.onboardingStatus = "inactive";
  vendor.suspensionReason = trimmedReason;
  await vendor.save();

  if (vendor.userId) {
    const linkedUser = await User.findById(vendor.userId);
    if (linkedUser) {
      const remainingRoles = (linkedUser.roles || []).filter((r) => r !== ROLES.VENDOR);
      const isMultiRole = remainingRoles.length > 0 && remainingRoles.includes(ROLES.CUSTOMER);
      if (isMultiRole) {
        // Multi-role user: keep user active as customer, strip vendor role, adjust primary role if needed
        await User.updateOne(
          { _id: linkedUser._id },
          {
            roles: remainingRoles,
            role: linkedUser.role === ROLES.VENDOR ? ROLES.CUSTOMER : linkedUser.role,
            $inc: { authVersion: 1 },
          }
        );
      } else {
        await User.updateOne(
          { _id: linkedUser._id },
          { isActive: false, deletedAt, $inc: { authVersion: 1 } }
        );
      }
      await RefreshToken.updateMany(
        { userId: vendor.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
  }

  // Safe Offboarding: Archive products and deactivate product variants
  const vendorProducts = await Product.find({ vendorId: vendor._id, deletedAt: null }).select("_id");
  const vendorProductIds = vendorProducts.map((p) => p._id);

  await Product.updateMany(
    { vendorId: vendor._id, deletedAt: null },
    { $set: { status: "archived", isStoreVisible: false, deletedAt } }
  );

  if (vendorProductIds.length > 0) {
    await ProductVariant.updateMany(
      { productId: { $in: vendorProductIds } },
      { $set: { isActive: false } }
    );
  }

  if (actorId) {
    await recordAuditLog({
      actorId,
      targetId: vendor._id,
      action: "vendor.offboarded",
      entityType: "Vendor",
      reason: trimmedReason,
      beforeState,
      afterState: vendor.toObject(),
      req: req || null,
    });
  }

  return {
    success: true,
    message: "Vendor account safely offboarded, active products archived, and vendor sessions invalidated",
  };
};

/**
 * Update authenticated vendor storefront branding
 */
const updateStoreBranding = async ({ userId, brandingData, req }) => {
  const vendor = await Vendor.findOne({ userId, deletedAt: null });
  if (!vendor) {
    throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
  }

  const beforeState = vendor.toObject();

  if (!vendor.branding) {
    vendor.branding = {};
  }

  if (brandingData.displayName !== undefined) vendor.branding.displayName = brandingData.displayName;
  if (brandingData.logo !== undefined) vendor.branding.logo = brandingData.logo;
  if (brandingData.banner !== undefined) vendor.branding.banner = brandingData.banner;
  if (brandingData.description !== undefined) vendor.branding.description = brandingData.description;
  if (brandingData.publicContactEmail !== undefined) vendor.branding.publicContactEmail = brandingData.publicContactEmail;
  if (brandingData.publicContactPhone !== undefined) vendor.branding.publicContactPhone = brandingData.publicContactPhone;
  if (brandingData.operatingHours !== undefined) vendor.branding.operatingHours = brandingData.operatingHours;

  if (brandingData.policies) {
    if (!vendor.branding.policies) vendor.branding.policies = {};
    if (brandingData.policies.shippingPolicy !== undefined) {
      vendor.branding.policies.shippingPolicy = brandingData.policies.shippingPolicy;
    }
    if (brandingData.policies.returnPolicy !== undefined) {
      vendor.branding.policies.returnPolicy = brandingData.policies.returnPolicy;
    }
    if (brandingData.policies.refundPolicy !== undefined) {
      vendor.branding.policies.refundPolicy = brandingData.policies.refundPolicy;
    }
  }

  if (brandingData.socialLinks) {
    if (!vendor.branding.socialLinks) vendor.branding.socialLinks = {};
    if (brandingData.socialLinks.website !== undefined) {
      vendor.branding.socialLinks.website = brandingData.socialLinks.website;
    }
    if (brandingData.socialLinks.instagram !== undefined) {
      vendor.branding.socialLinks.instagram = brandingData.socialLinks.instagram;
    }
    if (brandingData.socialLinks.facebook !== undefined) {
      vendor.branding.socialLinks.facebook = brandingData.socialLinks.facebook;
    }
    if (brandingData.socialLinks.twitter !== undefined) {
      vendor.branding.socialLinks.twitter = brandingData.socialLinks.twitter;
    }
  }

  await vendor.save();

  await recordAuditLog({
    actorId: userId,
    targetId: vendor._id,
    action: "VENDOR_BRANDING_UPDATED",
    entityType: "Vendor",
    beforeState,
    afterState: vendor.toObject(),
    req,
  });

  return vendor.branding;
};

/**
 * Upload store branding asset (logo or banner) to public storage
 */
const uploadStoreBrandingAsset = async ({ userId, file, assetType }) => {
  if (!file || !file.buffer) {
    throw new AppError("No image file uploaded", 400, "MISSING_FILE");
  }

  const vendor = await Vendor.findOne({ userId, deletedAt: null });
  if (!vendor) {
    throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
  }

  const { originalname, mimetype, size, buffer } = file;
  const ext = path.extname(originalname).toLowerCase();
  const normalizedMime = mimetype ? mimetype.toLowerCase() : "";

  // Reject SVG to prevent stored XSS
  if (
    normalizedMime === "image/svg+xml" ||
    ext === ".svg" ||
    buffer.slice(0, 100).toString("utf8").toLowerCase().includes("<svg")
  ) {
    throw new AppError(
      "SVG uploads are not permitted for security reasons (XSS risk). Please upload PNG, WebP, or JPEG.",
      400,
      "SVG_NOT_ALLOWED"
    );
  }

  const MAX_BRANDING_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
  if (size > MAX_BRANDING_IMAGE_SIZE) {
    throw new AppError("File size exceeds 2MB limit", 400, "FILE_TOO_LARGE");
  }

  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedMimes.includes(normalizedMime)) {
    throw new AppError("Invalid image format. Allowed: JPEG, PNG, WebP, GIF", 400, "INVALID_FILE_TYPE");
  }

  // Validate magic bytes
  const isMagicValid = (buf) => {
    if (!buf || buf.length < 4) return false;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // GIF
    if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true; // WEBP
    return false;
  };

  if (!isMagicValid(buffer)) {
    throw new AppError("Corrupted or invalid image file content.", 400, "CORRUPT_OR_INVALID_IMAGE");
  }

  const prefix = `vendors/${vendor._id}/branding`;
  const safeFilename = `${assetType || "media"}_${crypto.randomBytes(8).toString("hex")}${ext}`;

  const uploadRes = await uploadPublicMedia({
    filename: safeFilename,
    buffer,
    mimeType: normalizedMime,
    prefix,
  });

  return {
    url: uploadRes.url,
    key: uploadRes.key,
    size: uploadRes.size,
    mimeType: uploadRes.mimeType,
  };
};

/**
 * Public storefront query by vendor slug
 * Enforces strict privacy projection: zero leakage of sensitive tax/bank/KYC data
 */
const getPublicStoreBySlug = async (rawSlug) => {
  if (!rawSlug || typeof rawSlug !== "string") {
    throw new AppError("Store slug is required", 400, "INVALID_SLUG");
  }

  const cleanSlug = rawSlug.trim().toLowerCase();
  const vendor = await Vendor.findOne({
    businessSlug: cleanSlug,
    isActive: true,
    deletedAt: null,
  }).lean();

  if (!vendor) {
    throw new AppError("Store not found or currently inactive", 404, "STORE_NOT_FOUND");
  }

  return {
    businessName: vendor.businessName,
    businessSlug: vendor.businessSlug,
    branding: {
      displayName: vendor.branding?.displayName || vendor.businessName,
      logo: vendor.branding?.logo || null,
      banner: vendor.branding?.banner || null,
      description: vendor.branding?.description || null,
      publicContactEmail: vendor.branding?.publicContactEmail || null,
      publicContactPhone: vendor.branding?.publicContactPhone || null,
      policies: {
        shippingPolicy: vendor.branding?.policies?.shippingPolicy || null,
        returnPolicy: vendor.branding?.policies?.returnPolicy || null,
        refundPolicy: vendor.branding?.policies?.refundPolicy || null,
      },
      operatingHours: vendor.branding?.operatingHours || null,
      socialLinks: {
        website: vendor.branding?.socialLinks?.website || null,
        instagram: vendor.branding?.socialLinks?.instagram || null,
        facebook: vendor.branding?.socialLinks?.facebook || null,
        twitter: vendor.branding?.socialLinks?.twitter || null,
      },
    },
    kycApproved: vendor.kycStatus === "approved",
    location: {
      city: vendor.businessAddress?.city || null,
      state: vendor.businessAddress?.state || null,
      country: vendor.businessAddress?.country || "IN",
    },
    createdAt: vendor.createdAt,
  };
};

module.exports = {
  registerVendor,
  getMyVendorProfile,
  createVendorProfile,
  updateMyVendorProfile,
  listVendors,
  getVendorById,
  updateVendorStatus,
  approveVendor,
  rejectVendor,
  requestChanges,
  resubmitVendorApplication,
  getVendorDashboardAnalytics,
  getVendorActivityLogs,
  getVendorOverview,
  updateVendorAdmin,
  suspendVendor,
  reactivateVendor,
  resetVendorPassword,
  deleteVendor,
  verifyVendorEmailByAdmin,
  updateStoreBranding,
  uploadStoreBrandingAsset,
  getPublicStoreBySlug,
};