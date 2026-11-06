const mongoose = require("mongoose");
const CommissionPolicy = require("../models/CommissionPolicy");
const Vendor = require("../models/Vendor");
const AuditLog = require("../models/AuditLog");
const AppError = require("../errors/AppError");
const {
  COMMISSION_POLICY_SCOPES,
  COMMISSION_SOURCES,
} = require("../constants/finance.constants");

const toDecimal128 = (value) => {
  if (value instanceof mongoose.Types.Decimal128) {
    return value;
  }
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized)) {
    throw new AppError("Invalid decimal number", 422, "INVALID_DECIMAL");
  }
  return mongoose.Types.Decimal128.fromString(normalized.toFixed(2));
};

const toMinorUnits = (value) => {
  if (!value) return 0;
  const num = typeof value === "object" && value.toString ? Number(value.toString()) : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
};

const fromMinorUnits = (cents) => {
  return (cents / 100).toFixed(2);
};

/**
 * Validates scope consistency and target existence.
 */
const validateScopeTarget = async ({ scope, productId, vendorId, categoryId, session = null }) => {
  if (scope === COMMISSION_POLICY_SCOPES.PRODUCT) {
    if (!productId) {
      throw new AppError("Product ID is required for product-scoped policy", 422, "PRODUCT_ID_REQUIRED");
    }
    if (!mongoose.isValidObjectId(productId)) {
      throw new AppError("A valid Product ID is required for product-scoped policy", 422, "INVALID_PRODUCT_ID");
    }
  } else if (scope === COMMISSION_POLICY_SCOPES.VENDOR) {
    if (!vendorId) {
      throw new AppError("Vendor ID is required for vendor-scoped policy", 422, "VENDOR_ID_REQUIRED");
    }
    if (!mongoose.isValidObjectId(vendorId)) {
      throw new AppError("A valid Vendor ID is required for vendor-scoped policy", 422, "INVALID_VENDOR_ID");
    }
  } else if (scope === COMMISSION_POLICY_SCOPES.CATEGORY) {
    if (!categoryId) {
      throw new AppError("Category ID is required for category-scoped policy", 422, "CATEGORY_ID_REQUIRED");
    }
    if (!mongoose.isValidObjectId(categoryId)) {
      throw new AppError("A valid Category ID is required for category-scoped policy", 422, "INVALID_CATEGORY_ID");
    }
  } else if (scope === COMMISSION_POLICY_SCOPES.GLOBAL) {
    // Global scope must have no target IDs
  } else {
    throw new AppError(`Invalid commission scope: ${scope}`, 422, "INVALID_COMMISSION_SCOPE");
  }
};

/**
 * Checks for conflicting active policies that overlap in time for the exact same target.
 */
const assertNoActivePolicyConflict = async ({
  scope,
  productId = null,
  vendorId = null,
  categoryId = null,
  effectiveFrom,
  effectiveUntil = null,
  excludePolicyId = null,
  session = null,
}) => {
  const query = {
    scope,
    isActive: true,
    deletedAt: null,
  };

  if (excludePolicyId) {
    query._id = { $ne: excludePolicyId };
  }

  if (scope === COMMISSION_POLICY_SCOPES.PRODUCT) {
    query.productId = productId;
  } else if (scope === COMMISSION_POLICY_SCOPES.VENDOR) {
    query.vendorId = vendorId;
  } else if (scope === COMMISSION_POLICY_SCOPES.CATEGORY) {
    query.categoryId = categoryId;
  }

  const newFrom = new Date(effectiveFrom).getTime();
  const newUntil = effectiveUntil ? new Date(effectiveUntil).getTime() : Infinity;

  const existingPolicies = await CommissionPolicy.find(query).session(session).lean();

  for (const existing of existingPolicies) {
    const existFrom = new Date(existing.effectiveFrom).getTime();
    const existUntil = existing.effectiveUntil ? new Date(existing.effectiveUntil).getTime() : Infinity;

    // Overlap condition: startA <= endB && endA >= startB
    if (newFrom <= existUntil && newUntil >= existFrom) {
      throw new AppError(
        `Conflicting active policy '${existing.name}' already covers this ${scope} target during the specified timeframe`,
        409,
        "COMMISSION_POLICY_CONFLICT"
      );
    }
  }
};

/**
 * Create a new commission policy.
 */
const createPolicy = async ({
  name,
  description = "",
  scope,
  productId = null,
  vendorId = null,
  categoryId = null,
  rate,
  percentage = null,
  effectiveFrom = new Date(),
  effectiveUntil = null,
  priority = null,
  notes = null,
  actorId = null,
  ipAddress = null,
  userAgent = null,
}) => {
  let rateNum = Number(rate?.toString() || 0);
  if (rateNum > 1.0) {
    rateNum = rateNum / 100; // auto-convert 15 -> 0.15
  }

  if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 1.0) {
    throw new AppError(
      "Commission rate must be between 0.00 and 1.00 (0% to 100%)",
      422,
      "INVALID_COMMISSION_RATE"
    );
  }

  const calculatedPercentage = percentage !== null && percentage !== undefined
    ? Number(percentage)
    : Math.round(rateNum * 10000) / 100;

  await validateScopeTarget({ scope, productId, vendorId, categoryId });
  await assertNoActivePolicyConflict({
    scope,
    productId,
    vendorId,
    categoryId,
    effectiveFrom,
    effectiveUntil,
  });

  let assignedPriority = priority;
  if (!assignedPriority) {
    if (scope === COMMISSION_POLICY_SCOPES.PRODUCT) assignedPriority = 40;
    else if (scope === COMMISSION_POLICY_SCOPES.VENDOR) assignedPriority = 30;
    else if (scope === COMMISSION_POLICY_SCOPES.CATEGORY) assignedPriority = 20;
    else assignedPriority = 10;
  }

  const policy = await CommissionPolicy.create({
    name: name.trim(),
    description: (description || "").trim(),
    scope,
    productId: scope === COMMISSION_POLICY_SCOPES.PRODUCT ? productId : null,
    vendorId: scope === COMMISSION_POLICY_SCOPES.VENDOR ? vendorId : null,
    categoryId: scope === COMMISSION_POLICY_SCOPES.CATEGORY ? categoryId : null,
    rate: mongoose.Types.Decimal128.fromString(rateNum.toFixed(4)),
    percentage: calculatedPercentage,
    effectiveFrom: new Date(effectiveFrom),
    effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
    isActive: true,
    version: 1,
    priority: assignedPriority,
    notes,
    createdBy: actorId,
    updatedBy: actorId,
    versionHistory: [
      {
        version: 1,
        rate: mongoose.Types.Decimal128.fromString(rateNum.toFixed(4)),
        percentage: calculatedPercentage,
        effectiveFrom: new Date(effectiveFrom),
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
        notes: notes || "Initial policy creation",
        updatedBy: actorId,
        updatedAt: new Date(),
      },
    ],
  });

  await AuditLog.create({
    actorId,
    targetId: policy._id,
    action: "COMMISSION_POLICY_CREATED",
    entityType: "commission_policy",
    beforeState: null,
    afterState: {
      name: policy.name,
      scope: policy.scope,
      rate: policy.rate.toString(),
      percentage: policy.percentage,
      effectiveFrom: policy.effectiveFrom,
      effectiveUntil: policy.effectiveUntil,
    },
    reason: notes,
    ipAddress,
    userAgent,
  }).catch(() => {});

  return policy;
};

/**
 * Update an existing commission policy. Preserves version history.
 */
const updatePolicy = async (
  policyId,
  {
    name,
    description,
    rate,
    percentage,
    effectiveFrom,
    effectiveUntil,
    priority,
    notes = null,
    actorId = null,
    ipAddress = null,
    userAgent = null,
  }
) => {
  if (!mongoose.isValidObjectId(policyId)) {
    throw new AppError("Invalid policy ID", 400, "INVALID_POLICY_ID");
  }

  const policy = await CommissionPolicy.findById(policyId);
  if (!policy || policy.deletedAt) {
    throw new AppError("Commission policy not found", 404, "COMMISSION_POLICY_NOT_FOUND");
  }

  const beforeState = {
    name: policy.name,
    rate: policy.rate.toString(),
    percentage: policy.percentage,
    effectiveFrom: policy.effectiveFrom,
    effectiveUntil: policy.effectiveUntil,
    isActive: policy.isActive,
    version: policy.version,
  };

  let newRateNum = rate !== undefined ? Number(rate.toString()) : Number(policy.rate.toString());
  if (newRateNum > 1.0) {
    newRateNum = newRateNum / 100;
  }
  if (!Number.isFinite(newRateNum) || newRateNum < 0 || newRateNum > 1.0) {
    throw new AppError("Commission rate must be between 0.00 and 1.00", 422, "INVALID_COMMISSION_RATE");
  }

  const newPercentage = percentage !== undefined && percentage !== null
    ? Number(percentage)
    : Math.round(newRateNum * 10000) / 100;

  const newFrom = effectiveFrom ? new Date(effectiveFrom) : policy.effectiveFrom;
  const newUntil = effectiveUntil !== undefined
    ? (effectiveUntil ? new Date(effectiveUntil) : null)
    : policy.effectiveUntil;

  await assertNoActivePolicyConflict({
    scope: policy.scope,
    productId: policy.productId,
    vendorId: policy.vendorId,
    categoryId: policy.categoryId,
    effectiveFrom: newFrom,
    effectiveUntil: newUntil,
    excludePolicyId: policy._id,
  });

  policy.version += 1;
  if (name !== undefined) policy.name = name.trim();
  if (description !== undefined) policy.description = description.trim();
  policy.rate = mongoose.Types.Decimal128.fromString(newRateNum.toFixed(4));
  policy.percentage = newPercentage;
  policy.effectiveFrom = newFrom;
  policy.effectiveUntil = newUntil;
  if (priority !== undefined) policy.priority = priority;
  if (notes !== undefined) policy.notes = notes;
  policy.updatedBy = actorId;

  // Add the newly updated version to history so each version is tracked
  policy.versionHistory.push({
    version: policy.version,
    rate: policy.rate,
    percentage: policy.percentage,
    effectiveFrom: policy.effectiveFrom,
    effectiveUntil: policy.effectiveUntil,
    notes: notes || "Version updated",
    updatedBy: actorId,
    updatedAt: new Date(),
  });

  await policy.save();

  await AuditLog.create({
    actorId,
    targetId: policy._id,
    action: "COMMISSION_POLICY_UPDATED",
    entityType: "commission_policy",
    beforeState,
    afterState: {
      name: policy.name,
      rate: policy.rate.toString(),
      percentage: policy.percentage,
      effectiveFrom: policy.effectiveFrom,
      effectiveUntil: policy.effectiveUntil,
      version: policy.version,
    },
    reason: notes,
    ipAddress,
    userAgent,
  }).catch(() => {});

  return policy;
};

/**
 * Toggle active/inactive state of a policy.
 */
const togglePolicyStatus = async (policyId, { isActive, notes = null, actorId = null, ipAddress = null, userAgent = null }) => {
  if (!mongoose.isValidObjectId(policyId)) {
    throw new AppError("Invalid policy ID", 400, "INVALID_POLICY_ID");
  }

  const policy = await CommissionPolicy.findById(policyId);
  if (!policy || policy.deletedAt) {
    throw new AppError("Commission policy not found", 404, "COMMISSION_POLICY_NOT_FOUND");
  }

  if (isActive && !policy.isActive) {
    // Ensure no conflict before activating
    await assertNoActivePolicyConflict({
      scope: policy.scope,
      productId: policy.productId,
      vendorId: policy.vendorId,
      categoryId: policy.categoryId,
      effectiveFrom: policy.effectiveFrom,
      effectiveUntil: policy.effectiveUntil,
      excludePolicyId: policy._id,
    });
  }

  const previousState = { isActive: policy.isActive };
  policy.isActive = Boolean(isActive);
  policy.updatedBy = actorId;
  await policy.save();

  await AuditLog.create({
    actorId,
    targetId: policy._id,
    action: policy.isActive ? "COMMISSION_POLICY_ACTIVATED" : "COMMISSION_POLICY_DEACTIVATED",
    entityType: "commission_policy",
    beforeState: previousState,
    afterState: { isActive: policy.isActive },
    reason: notes,
    ipAddress,
    userAgent,
  }).catch(() => {});

  return policy;
};

/**
 * Soft delete a commission policy.
 */
const deletePolicy = async (policyId, { notes = null, actorId = null, ipAddress = null, userAgent = null }) => {
  if (!mongoose.isValidObjectId(policyId)) {
    throw new AppError("Invalid policy ID", 400, "INVALID_POLICY_ID");
  }

  const policy = await CommissionPolicy.findById(policyId);
  if (!policy || policy.deletedAt) {
    throw new AppError("Commission policy not found", 404, "COMMISSION_POLICY_NOT_FOUND");
  }

  policy.deletedAt = new Date();
  policy.isActive = false;
  policy.updatedBy = actorId;
  await policy.save();

  await AuditLog.create({
    actorId,
    targetId: policy._id,
    action: "COMMISSION_POLICY_DELETED",
    entityType: "commission_policy",
    beforeState: { isActive: true, deletedAt: null },
    afterState: { isActive: false, deletedAt: policy.deletedAt },
    reason: notes,
    ipAddress,
    userAgent,
  }).catch(() => {});

  return policy;
};

/**
 * Get policy by ID.
 */
const getPolicyById = async (policyId) => {
  if (!mongoose.isValidObjectId(policyId)) {
    throw new AppError("Invalid policy ID", 400, "INVALID_POLICY_ID");
  }

  const policy = await CommissionPolicy.findOne({ _id: policyId, deletedAt: null })
    .populate("productId", "name sku")
    .populate("vendorId", "businessName storeName businessSlug")
    .populate("categoryId", "name slug")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!policy) {
    throw new AppError("Commission policy not found", 404, "COMMISSION_POLICY_NOT_FOUND");
  }

  return policy;
};

/**
 * List commission policies with pagination and filtering.
 */
const listPolicies = async ({ scope = null, isActive = null, page = 1, limit = 20, search = null }) => {
  const query = { deletedAt: null };

  if (scope) query.scope = scope;
  if (isActive !== null && isActive !== undefined) query.isActive = Boolean(isActive);
  if (search) {
    query.name = { $regex: search.trim(), $options: "i" };
  }

  const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

  const [items, total] = await Promise.all([
    CommissionPolicy.find(query)
      .populate("productId", "name sku")
      .populate("vendorId", "businessName storeName businessSlug")
      .populate("categoryId", "name slug")
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CommissionPolicy.countDocuments(query),
  ]);

  return {
    items,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Authoritative Precedence Resolution Engine:
 * 1. Product-specific override (priority 40)
 * 2. Vendor-specific agreement (priority 30)
 *    a) CommissionPolicy (scope: "vendor")
 *    b) Vendor profile commissionRate (if > 0, source: "vendor_profile")
 * 3. Category-specific rule (priority 20)
 * 4. Global default policy (priority 10)
 * 5. Platform legacy default (10% / 0.10, source: "legacy_fallback")
 */
const resolveCommissionPolicy = async ({
  productId = null,
  vendorId = null,
  categoryId = null,
  targetDate = new Date(),
  session = null,
}) => {
  const date = new Date(targetDate);

  // 1. Product Override
  if (productId && mongoose.isValidObjectId(productId)) {
    const productPolicy = await CommissionPolicy.findOne({
      scope: COMMISSION_POLICY_SCOPES.PRODUCT,
      productId,
      isActive: true,
      deletedAt: null,
      effectiveFrom: { $lte: date },
      $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: date } }],
    })
      .session(session)
      .lean();

    if (productPolicy) {
      const rateNum = Number(productPolicy.rate.toString());
      return {
        policyId: productPolicy._id,
        policyVersion: productPolicy.version || 1,
        policyName: productPolicy.name,
        scope: COMMISSION_POLICY_SCOPES.PRODUCT,
        source: COMMISSION_SOURCES.PRODUCT,
        rate: mongoose.Types.Decimal128.fromString(rateNum.toFixed(4)),
        percentage: productPolicy.percentage,
        priority: productPolicy.priority || 40,
        currency: "INR",
      };
    }
  }

  // 2. Vendor Agreement
  if (vendorId && mongoose.isValidObjectId(vendorId)) {
    // 2a. Vendor Policy
    const vendorPolicy = await CommissionPolicy.findOne({
      scope: COMMISSION_POLICY_SCOPES.VENDOR,
      vendorId,
      isActive: true,
      deletedAt: null,
      effectiveFrom: { $lte: date },
      $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: date } }],
    })
      .session(session)
      .lean();

    if (vendorPolicy) {
      const rateNum = Number(vendorPolicy.rate.toString());
      return {
        policyId: vendorPolicy._id,
        policyVersion: vendorPolicy.version || 1,
        policyName: vendorPolicy.name,
        scope: COMMISSION_POLICY_SCOPES.VENDOR,
        source: COMMISSION_SOURCES.VENDOR,
        rate: mongoose.Types.Decimal128.fromString(rateNum.toFixed(4)),
        percentage: vendorPolicy.percentage,
        priority: vendorPolicy.priority || 30,
        currency: "INR",
      };
    }

    // 2b. Vendor Profile Agreement (never silently override existing vendor agreement)
    const vendor = await Vendor.findById(vendorId).session(session).lean();
    if (vendor && vendor.commissionRate) {
      let vRate = Number(vendor.commissionRate.toString());
      if (vRate > 1.0) vRate = vRate / 100;
      if (vRate > 0) {
        return {
          policyId: null,
          policyVersion: 1,
          policyName: `Vendor Agreement (${vendor.storeName || vendor.businessName || "Custom"})`,
          scope: COMMISSION_POLICY_SCOPES.VENDOR,
          source: COMMISSION_SOURCES.VENDOR_PROFILE,
          rate: mongoose.Types.Decimal128.fromString(vRate.toFixed(4)),
          percentage: Math.round(vRate * 10000) / 100,
          priority: 30,
          currency: "INR",
        };
      }
    }
  }

  // 3. Category Rule
  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    const categoryPolicy = await CommissionPolicy.findOne({
      scope: COMMISSION_POLICY_SCOPES.CATEGORY,
      categoryId,
      isActive: true,
      deletedAt: null,
      effectiveFrom: { $lte: date },
      $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: date } }],
    })
      .session(session)
      .lean();

    if (categoryPolicy) {
      const rateNum = Number(categoryPolicy.rate.toString());
      return {
        policyId: categoryPolicy._id,
        policyVersion: categoryPolicy.version || 1,
        policyName: categoryPolicy.name,
        scope: COMMISSION_POLICY_SCOPES.CATEGORY,
        source: COMMISSION_SOURCES.CATEGORY,
        rate: mongoose.Types.Decimal128.fromString(rateNum.toFixed(4)),
        percentage: categoryPolicy.percentage,
        priority: categoryPolicy.priority || 20,
        currency: "INR",
      };
    }
  }

  // 4. Global Default Policy
  const globalPolicy = await CommissionPolicy.findOne({
    scope: COMMISSION_POLICY_SCOPES.GLOBAL,
    isActive: true,
    deletedAt: null,
    effectiveFrom: { $lte: date },
    $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: date } }],
  })
    .session(session)
    .lean();

  if (globalPolicy) {
    const rateNum = Number(globalPolicy.rate.toString());
    return {
      policyId: globalPolicy._id,
      policyVersion: globalPolicy.version || 1,
      policyName: globalPolicy.name,
      scope: COMMISSION_POLICY_SCOPES.GLOBAL,
      source: COMMISSION_SOURCES.GLOBAL,
      rate: mongoose.Types.Decimal128.fromString(rateNum.toFixed(4)),
      percentage: globalPolicy.percentage,
      priority: globalPolicy.priority || 10,
      currency: "INR",
    };
  }

  // 5. Legacy Fallback (10% default documented in VW-01)
  return {
    policyId: null,
    policyVersion: 1,
    policyName: "Platform Legacy Default (10%)",
    scope: null,
    source: COMMISSION_SOURCES.LEGACY_FALLBACK,
    rate: mongoose.Types.Decimal128.fromString("0.1000"),
    percentage: 10.0,
    priority: 0,
    currency: "INR",
  };
};

/**
 * Calculate item commission using exact minor-unit integer arithmetic.
 * Ensures commission + vendorNetEntitlement === calculationBase.
 */
const calculateItemCommission = async ({
  item,
  resolvedPolicy = null,
  targetDate = new Date(),
  session = null,
}) => {
  const policy = resolvedPolicy || (await resolveCommissionPolicy({
    productId: item.productId,
    vendorId: item.vendorId,
    categoryId: item.categoryId,
    targetDate,
    session,
  }));

  const rateNum = Number(policy.rate.toString());

  const lineTotalMinor = toMinorUnits(item.lineTotal);
  const discountMinor = toMinorUnits(item.discountTotal || item.couponDiscountAmount || 0);

  let subsidyMinor = 0;
  if (
    item.isPromotional &&
    item.fundingSource === "platform" &&
    item.promotionDiscountAmount != null
  ) {
    const qty = Number(item.quantity || 1);
    subsidyMinor = Math.round(Number(item.promotionDiscountAmount.toString()) * qty * 100);
  }

  // Contractual calculation base: lineTotal + platformSubsidy - vendorDiscounts
  const baseMinor = Math.max(0, lineTotalMinor + subsidyMinor - discountMinor);
  const commissionMinor = Math.round(baseMinor * rateNum);
  const vendorNetMinor = Math.max(0, baseMinor - commissionMinor);

  return {
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    policyName: policy.policyName,
    source: policy.source,
    scope: policy.scope || null,
    commissionRate: policy.rate,
    appliedRate: policy.rate,
    commissionPercentage: policy.percentage,
    calculationBase: mongoose.Types.Decimal128.fromString(fromMinorUnits(baseMinor)),
    commissionAmount: mongoose.Types.Decimal128.fromString(fromMinorUnits(commissionMinor)),
    vendorNetEntitlement: mongoose.Types.Decimal128.fromString(fromMinorUnits(vendorNetMinor)),
    currency: item.currency || "INR",
    calculatedAt: new Date(),
    calculationVersion: 1,
    discountDeducted: mongoose.Types.Decimal128.fromString(fromMinorUnits(discountMinor)),
    subsidyAdded: mongoose.Types.Decimal128.fromString(fromMinorUnits(subsidyMinor)),
    isLocked: false,
  };
};

/**
 * Preview commission snapshot for cart / order items before payment capture.
 */
const computeOrderItemsCommissionPreview = async ({
  orderItems = [],
  targetDate = new Date(),
  session = null,
}) => {
  const enhancedItems = [];

  for (const it of orderItems) {
    const snapshot = await calculateItemCommission({
      item: it,
      targetDate,
      session,
    });

    enhancedItems.push({
      ...it,
      commissionRate: snapshot.commissionRate,
      commissionAmount: snapshot.commissionAmount,
      commissionSnapshot: snapshot,
    });
  }

  return enhancedItems;
};

/**
 * Permanently locks immutable commission snapshots upon payment confirmation/capture.
 * Guarantees that subsequent policy changes do NOT retroactively alter historical orders.
 * Accepts either an Order mongoose document or a raw array of order items.
 */
const lockOrderItemsCommissionSnapshot = async (orderDocOrItems, { session = null } = {}) => {
  if (!orderDocOrItems) {
    return orderDocOrItems;
  }

  const isArray = Array.isArray(orderDocOrItems);
  const items = isArray ? orderDocOrItems : orderDocOrItems.items;

  if (!items || !Array.isArray(items)) {
    return orderDocOrItems;
  }

  let hasChanges = false;
  const targetDate = isArray ? new Date() : (orderDocOrItems.placedAt || orderDocOrItems.createdAt || new Date());

  for (let i = 0; i < items.length; i++) {
    const it = items[i];

    if (it.commissionSnapshot && it.commissionSnapshot.isLocked) {
      // Already immutably locked — do not recompute or overwrite!
      continue;
    }

    if (it.commissionSnapshot && it.commissionSnapshot.commissionRate) {
      // Preview exists: lock it into authoritative state
      it.commissionSnapshot.isLocked = true;
      it.commissionSnapshot.calculatedAt = new Date();
      if (!it.commissionSnapshot.appliedRate) {
        it.commissionSnapshot.appliedRate = it.commissionSnapshot.commissionRate;
      }
      it.commissionRate = it.commissionSnapshot.commissionRate;
      it.commissionAmount = it.commissionSnapshot.commissionAmount;
      hasChanges = true;
    } else {
      // Legacy or missing preview: compute and lock atomically
      const snapshot = await calculateItemCommission({
        item: it,
        targetDate,
        session,
      });
      snapshot.isLocked = true;
      snapshot.appliedRate = snapshot.commissionRate;
      it.commissionSnapshot = snapshot;
      it.commissionRate = snapshot.commissionRate;
      it.commissionAmount = snapshot.commissionAmount;
      hasChanges = true;
    }
  }

  if (hasChanges && typeof orderDocOrItems.save === "function") {
    await orderDocOrItems.save({ session });
  }

  return orderDocOrItems;
};

/**
 * Refund and reversal foundation:
 * Calculates commission reversal referencing the original order item snapshot.
 */
const calculateCommissionReversal = ({
  orderItem,
  refundedQuantity = 1,
  refundedAmount = null,
}) => {
  let rateNum = 0.10; // legacy default fallback

  if (orderItem.commissionSnapshot?.commissionRate) {
    rateNum = Number(orderItem.commissionSnapshot.commissionRate.toString());
  } else if (orderItem.commissionRate) {
    rateNum = Number(orderItem.commissionRate.toString());
  }

  const refundMinor = refundedAmount !== null && refundedAmount !== undefined
    ? toMinorUnits(refundedAmount)
    : Math.round(Number(orderItem.unitPrice?.toString() || 0) * Number(refundedQuantity) * 100);

  const reversedCommissionMinor = Math.round(refundMinor * rateNum);
  const vendorNetDebitMinor = Math.max(0, refundMinor - reversedCommissionMinor);

  return {
    orderId: orderItem.orderId || null,
    orderItemId: orderItem._id || null,
    policyId: orderItem.commissionSnapshot?.policyId || null,
    appliedRate: mongoose.Types.Decimal128.fromString(rateNum.toFixed(4)),
    refundAmount: mongoose.Types.Decimal128.fromString(fromMinorUnits(refundMinor)),
    reversedCommissionAmount: mongoose.Types.Decimal128.fromString(fromMinorUnits(reversedCommissionMinor)),
    vendorNetAdjustment: mongoose.Types.Decimal128.fromString(fromMinorUnits(vendorNetDebitMinor)),
    currency: orderItem.currency || "INR",
    reversalTimestamp: new Date(),
  };
};

/**
 * Server-authoritative commission preview calculation for finance administrators.
 * Read-only: does not create orders, ledger entries, settlements, or wallet mutations.
 */
const previewCommissionCalculation = async ({
  vendorId = null,
  productId = null,
  categoryId = null,
  amount,
  currency = "INR",
  targetDate = new Date(),
}) => {
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new AppError("Preview amount must be a positive number", 400, "INVALID_PREVIEW_AMOUNT");
  }

  const grossMinor = Math.round(amountNum * 100);
  const resolved = await resolveCommissionPolicy({
    productId: productId || null,
    vendorId: vendorId || null,
    categoryId: categoryId || null,
    targetDate: targetDate || new Date(),
  });

  const rateNum = Number(resolved.rate?.toString() || 0);
  const commissionMinor = Math.round(grossMinor * rateNum);
  const vendorNetMinor = Math.max(0, grossMinor - commissionMinor);

  // Precedence hierarchy mapping
  const precedenceMap = {
    [COMMISSION_POLICY_SCOPES.PRODUCT]: { rank: 1, label: "Product Override (Rank 1 - Highest Priority)" },
    [COMMISSION_POLICY_SCOPES.VENDOR]: { rank: 2, label: "Vendor Agreement (Rank 2)" },
    [COMMISSION_POLICY_SCOPES.CATEGORY]: { rank: 3, label: "Category Rule (Rank 3)" },
    [COMMISSION_POLICY_SCOPES.GLOBAL]: { rank: 4, label: "Global Platform Default (Rank 4)" },
    legacy_fallback: { rank: 5, label: "Legacy Fallback Default (Rank 5)" },
  };

  const scopeKey = resolved.scope || "legacy_fallback";
  const precedenceInfo = precedenceMap[scopeKey] || { rank: 5, label: "Legacy Fallback (Rank 5)" };

  return {
    policy: {
      id: resolved.policyId || resolved._id || null,
      name: resolved.policyName || resolved.name,
      scope: resolved.scope || null,
      precedenceRank: precedenceInfo.rank,
      precedenceLabel: precedenceInfo.label,
      rate: rateNum,
      percentage: resolved.percentage || Number((rateNum * 100).toFixed(2)),
      version: resolved.policyVersion || resolved.version || 1,
      effectiveFrom: resolved.effectiveFrom,
      effectiveUntil: resolved.effectiveUntil || null,
      priority: resolved.priority,
    },
    calculation: {
      currency: String(currency || "INR").toUpperCase(),
      grossAmount: (grossMinor / 100).toFixed(2),
      grossAmountMinor: grossMinor,
      commissionRate: rateNum,
      commissionPercentage: `${(rateNum * 100).toFixed(2)}%`,
      commissionAmount: (commissionMinor / 100).toFixed(2),
      commissionAmountMinor: commissionMinor,
      vendorNetAmount: (vendorNetMinor / 100).toFixed(2),
      vendorNetAmountMinor: vendorNetMinor,
    },
    isIllustrativePreview: true,
  };
};

module.exports = {
  createPolicy,
  updatePolicy,
  togglePolicyStatus,
  deletePolicy,
  getPolicyById,
  listPolicies,
  resolveCommissionPolicy,
  previewCommissionCalculation,
  calculateItemCommission,
  computeOrderItemsCommissionPreview,
  lockOrderItemsCommissionSnapshot,
  calculateCommissionReversal,
  toMinorUnits,
  fromMinorUnits,
  toDecimal128,
};
