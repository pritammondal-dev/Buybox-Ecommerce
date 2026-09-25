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
const { hashPassword } = require("../utils/password");
const { ROLES } = require("../constants/auth.constants");
const AppError = require("../errors/AppError");
const { encodeSecureId, decodeSecureId } = require("../utils/secure-id.util");
const { projectVendorOrder } = require("./order.service");
const EmailService = require("./email.service");
const emailService = new EmailService();
const { recordAuditLog } = require("./governance.service");
const logger = require("../config/logger");

const registerVendor = async ({
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
}) => {
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
    if (existingUser.isEmailVerified) {
      throw new AppError(
        "An account may already be associated with this email. Please sign in or use Forgot Password.",
        409,
        "EMAIL_ALREADY_EXISTS"
      );
    }

    // Existing unverified vendor: Resume verification lifecycle without creating duplicate records
    if (existingUser.role === ROLES.VENDOR) {
      const existingVendor = await Vendor.findOne({ userId: existingUser._id });
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

      const isDevOrTest = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

      if (!emailResult || emailResult.success === false) {
        logger.warn("Failed to deliver vendor verification email on retry:", {
          recipient: normalizedEmail,
          status: emailResult?.status,
          error: emailResult?.error,
        });
      }

      return {
        user: {
          id: existingUser._id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: existingUser.role,
          isEmailVerified: false,
          requireVerification: true,
        },
        vendor: existingVendor
          ? {
              id: existingVendor._id,
              businessName: existingVendor.businessName,
              businessSlug: existingVendor.businessSlug,
              onboardingStatus: existingVendor.onboardingStatus,
              isActive: existingVendor.isActive,
            }
          : null,
        resendCooldownSeconds,
        ...(isDevOrTest ? { devOtp: otp } : {}),
      };
    }

    // Account exists under another role (e.g. customer)
    throw new AppError(
      "An account may already be associated with this email. Please sign in or use Forgot Password.",
      409,
      "EMAIL_ALREADY_EXISTS"
    );
  }

  // 2. New vendor registration transaction
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
            password: passwordHash,
            firstName,
            lastName,
            role: ROLES.VENDOR,
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
            phone: phone || null,
            supportEmail: supportEmail || null,
            businessAddress: businessAddress || {},
            taxInformation: taxInformation || {},
            onboardingStatus: "pending",
            isActive: false,
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

    const isDevOrTest = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

    if (!emailResult || emailResult.success === false) {
      logger.warn("Failed to deliver vendor verification email:", {
        recipient: normalizedEmail,
        status: emailResult?.status,
        error: emailResult?.error,
      });
    }

    return {
      user: result.user,
      vendor: result.vendor,
      resendCooldownSeconds,
      ...(isDevOrTest ? { devOtp: otp } : {}),
    };
  } catch (err) {
    if (err.code === 11000 || (err.message && err.message.includes("duplicate key"))) {
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
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const filter = { deletedAt: null };

  if (status && status !== "all") {
    filter.onboardingStatus = status;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    const matchingUsers = await User.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
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

  const sortField = ["createdAt", "businessName", "onboardingStatus", "approvedAt"].includes(sortBy)
    ? sortBy
    : "createdAt";
  const sortDirection = sortOrder === "asc" ? 1 : -1;

  const vendors = await Vendor.find(filter)
    .sort({ [sortField]: sortDirection })
    .skip(skip)
    .limit(safeLimit)
    .populate("userId", "firstName lastName email avatar role isActive createdAt")
    .populate("approvedBy", "firstName lastName email")
    .populate("rejectedBy", "firstName lastName email")
    .populate("changesRequestedBy", "firstName lastName email")
    .lean();

  const mappedVendors = vendors.map((v) => ({
    ...v,
    secureId: encodeSecureId("vendor", v._id),
  }));

  return {
    vendors: mappedVendors,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

const getVendorById = async (vendorId) => {
  const resolvedId = decodeSecureId(vendorId, "vendor", { strict: false });

  const vendor = await Vendor.findOne({
    _id: resolvedId,
    deletedAt: null,
  })
    .populate("userId", "firstName lastName email avatar role isActive createdAt")
    .populate("approvedBy", "firstName lastName email")
    .populate("rejectedBy", "firstName lastName email")
    .populate("changesRequestedBy", "firstName lastName email");

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  const [productsCount, ordersCount] = await Promise.all([
    Product.countDocuments({ vendorId: vendor._id, deletedAt: null }),
    Order.countDocuments({ "vendorItems.vendorId": vendor._id }),
  ]);

  const vendorObj = vendor.toObject();
  vendorObj.secureId = encodeSecureId("vendor", vendor._id);
  vendorObj.productsCount = productsCount;
  vendorObj.ordersCount = ordersCount;

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
      const vendor = await Vendor.findOne({ _id: resolvedId, deletedAt: null }).session(session);
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

  await vendor.save();

  if (options.actorId) {
    await recordAuditLog({
      actorId: options.actorId,
      targetId: vendor._id,
      action: `VENDOR_STATUS_UPDATED_${onboardingStatus.toUpperCase()}`,
      entityType: "Vendor",
      beforeState,
      afterState: vendor.toObject(),
      req: options.req || null,
    }).catch((err) => logger.warn(`Audit log failed: ${err.message}`));
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

  // 3. Orders analytics
  const orders = await Order.find({
    "items.vendorId": vendorObjId,
  })
    .sort({ createdAt: -1 })
    .lean();

  let totalGrossSalesMinor = 0;
  let todaySalesMinor = 0;
  const totalOrdersCount = orders.length;
  let pendingOrdersCount = 0;

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

  for (const order of orders) {
    const isCancelled = ["cancelled", "expired"].includes(order.status);
    const isPending =
      ["pending_payment", "confirmed", "processing", "packed"].includes(order.status) &&
      order.fulfillmentStatus !== "fulfilled";

    if (isPending) {
      pendingOrdersCount++;
    }

    const orderCreated = new Date(order.createdAt);
    const orderDateKey = orderCreated.toISOString().slice(0, 10);

    for (const item of order.items || []) {
      if (item.vendorId && item.vendorId.toString() === vendorObjId.toString()) {
        const lineTotalNum = Number(item.lineTotal?.toString() || 0);
        const lineTotalMinor = Math.round(lineTotalNum * 100);

        if (!isCancelled) {
          totalGrossSalesMinor += lineTotalMinor;

          if (orderCreated >= startOfToday) {
            todaySalesMinor += lineTotalMinor;
          }

          if (orderCreated >= rangeStartDate && salesTrendMap.has(orderDateKey)) {
            const bucket = salesTrendMap.get(orderDateKey);
            bucket.sales += lineTotalNum;
            bucket.units += item.quantity || 1;
          }
        }
      }
    }

    if (!isCancelled && orderCreated >= rangeStartDate && salesTrendMap.has(orderDateKey)) {
      const bucket = salesTrendMap.get(orderDateKey);
      bucket.orders += 1;
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
  const recentOrders = orders.slice(0, 5).map((order) => {
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
};