const mongoose = require("mongoose");

const { VendorSettlement } = require("../models/VendorSettlement");
const vendorSettlementRepository = require("../repositories/vendor-settlement.repository");

const AppError = require("../errors/AppError");

const toDecimal128 = (value) => {
  return mongoose.Types.Decimal128.fromString(
    Number(value || 0).toFixed(2)
  );
};

const decimalToNumber = (value) => {
  return Number(value?.toString() || "0");
};

const generateSettlementNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  return `SET-${timestamp}-${random}`;
};

const calculateNetPayable = ({
  grossSales,
  discounts,
  refunds,
  platformCommission,
}) => {
  const gross = decimalToNumber(grossSales);
  const discount = decimalToNumber(discounts);
  const refund = decimalToNumber(refunds);
  const commission = decimalToNumber(platformCommission);

  const net = gross - discount - refund - commission;

  if (net < 0) {
    throw new AppError(
      "Settlement net payable cannot be negative",
      422,
      "INVALID_SETTLEMENT_AMOUNT"
    );
  }

  return toDecimal128(net);
};

const createSettlement = async ({
  vendorId,
  periodStart,
  periodEnd,
  currency,
  grossSales = "0.00",
  discounts = "0.00",
  refunds = "0.00",
  platformCommission = "0.00",
  idempotencyKey = null,
  metadata = {},
}) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError(
      "Invalid vendor ID",
      400,
      "INVALID_VENDOR_ID"
    );
  }

  if (idempotencyKey) {
    const existing =
      await vendorSettlementRepository.findByIdempotencyKey(
        vendorId,
        idempotencyKey
      );

    if (existing) {
      return existing;
    }
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    throw new AppError(
      "Invalid settlement period",
      422,
      "INVALID_SETTLEMENT_PERIOD"
    );
  }

  const normalizedCurrency = String(currency || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new AppError(
      "Invalid settlement currency",
      422,
      "INVALID_SETTLEMENT_CURRENCY"
    );
  }

  const netPayable = calculateNetPayable({
    grossSales,
    discounts,
    refunds,
    platformCommission,
  });

  const session = await mongoose.startSession();

  try {
    let settlement;

    await session.withTransaction(async () => {
      if (idempotencyKey) {
        const existing =
          await vendorSettlementRepository.findByIdempotencyKey(
            vendorId,
            idempotencyKey,
            { session }
          );

        if (existing) {
          settlement = existing;
          return;
        }
      }

      settlement = await vendorSettlementRepository.create(
        {
          vendorId,
          settlementNumber: generateSettlementNumber(),
          periodStart: start,
          periodEnd: end,
          currency: normalizedCurrency,
          grossSales: toDecimal128(grossSales),
          discounts: toDecimal128(discounts),
          refunds: toDecimal128(refunds),
          platformCommission: toDecimal128(platformCommission),
          netPayable,
          status: "pending",
          idempotencyKey,
          metadata,
        },
        { session }
      );
    });

    return settlement;
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) {
      const existing =
        await vendorSettlementRepository.findByIdempotencyKey(
          vendorId,
          idempotencyKey
        );

      if (existing) {
        return existing;
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

const markProcessing = async (settlementId) => {
  const settlement =
    await vendorSettlementRepository.findById(settlementId);

  if (!settlement) {
    throw new AppError(
      "Settlement not found",
      404,
      "SETTLEMENT_NOT_FOUND"
    );
  }

  if (settlement.status === "processing") {
    return settlement;
  }

  if (settlement.status !== "pending") {
    throw new AppError(
      `Cannot process settlement from ${settlement.status}`,
      409,
      "INVALID_SETTLEMENT_STATUS_TRANSITION"
    );
  }

  return vendorSettlementRepository.updateById(settlementId, {
    status: "processing",
    processedAt: new Date(),
  });
};

const markPayable = async (settlementId) => {
  const settlement =
    await vendorSettlementRepository.findById(settlementId);

  if (!settlement) {
    throw new AppError(
      "Settlement not found",
      404,
      "SETTLEMENT_NOT_FOUND"
    );
  }

  if (settlement.status === "payable") {
    return settlement;
  }

  if (settlement.status !== "processing") {
    throw new AppError(
      `Cannot mark settlement payable from ${settlement.status}`,
      409,
      "INVALID_SETTLEMENT_STATUS_TRANSITION"
    );
  }

  return vendorSettlementRepository.updateById(settlementId, {
    status: "payable",
  });
};

const getSettlementById = async (settlementId) => {
  if (!mongoose.isValidObjectId(settlementId)) {
    throw new AppError("Invalid settlement ID", 400, "INVALID_SETTLEMENT_ID");
  }

  const settlement = await vendorSettlementRepository.findById(settlementId);

  if (!settlement) {
    throw new AppError(
      "Settlement not found",
      404,
      "SETTLEMENT_NOT_FOUND"
    );
  }

  return settlement;
};

const getSettlementsByVendorId = async (vendorId) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  return vendorSettlementRepository.findByVendorId(vendorId);
};

const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const { encodeSecureId, decodeSecureId } = require("../utils/secure-id.util");
const Vendor = require("../models/Vendor");
const Order = require("../models/Order");
const ReturnRequest = require("../models/ReturnRequest");

const calculateVendorEligibleSettlement = async ({ vendorId }) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  const returnWindowCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const deliveredOrders = await Order.find({
    status: { $in: ["delivered", "completed"] },
    paymentStatus: { $in: ["paid", "partially_refunded"] },
    "items.vendorId": vendor._id,
    $or: [
      { deliveredAt: { $lte: returnWindowCutoff } },
      { deliveredAt: null, updatedAt: { $lte: returnWindowCutoff } },
    ],
  }).lean();

  let grossSalesNum = 0;
  let discountsNum = 0;
  let refundsNum = 0;

  const eligibleOrders = [];
  const eligibleItems = [];

  for (const order of deliveredOrders) {
    let orderHasEligibleItems = false;
    for (const item of (order.items || [])) {
      if (
        item.vendorId &&
        item.vendorId.toString() === vendor._id.toString() &&
        !item.settlementId &&
        item.fulfillmentStatus !== "cancelled"
      ) {
        orderHasEligibleItems = true;
        const lineTotal = Number(
          item.lineTotal?.toString() ||
            (item.quantity * Number(item.unitPrice?.toString() || 0))
        );
        grossSalesNum += lineTotal;

        eligibleItems.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice?.toString(),
          lineTotal: lineTotal.toFixed(2),
        });
      }
    }
    if (orderHasEligibleItems) {
      eligibleOrders.push(order);
    }
  }

  if (eligibleOrders.length > 0) {
    const orderIds = eligibleOrders.map((o) => o._id);
    const completedReturns = await ReturnRequest.find({
      orderId: { $in: orderIds },
      status: { $in: ["received", "refunded"] },
    }).lean();

    for (const ret of completedReturns) {
      for (const item of (ret.items || [])) {
        if (item.vendorId && item.vendorId.toString() === vendor._id.toString()) {
          const itemPrice = Number(item.itemPrice?.toString() || 0);
          refundsNum += itemPrice * (item.quantity || 1);
        }
      }
    }
  }

  let rate = Number(vendor.commissionRate?.toString() || "0");
  if (rate > 1) {
    rate = rate / 100;
  } else if (rate <= 0) {
    rate = 0.10;
  }

  const netSales = Math.max(0, grossSalesNum - discountsNum);
  const platformCommissionNum = Math.round(netSales * rate * 100) / 100;
  const netPayableNum = Math.max(0, grossSalesNum - discountsNum - refundsNum - platformCommissionNum);

  return {
    vendorId: vendor._id,
    currency: "INR",
    commissionRate: rate,
    grossSales: grossSalesNum,
    discounts: discountsNum,
    refunds: refundsNum,
    platformCommission: platformCommissionNum,
    netPayable: netPayableNum,
    eligibleOrders,
    eligibleItems,
  };
};

const generateEligibleSettlements = async ({
  vendorId = null,
  periodStart = null,
  periodEnd = null,
  adminUserId = null,
  idempotencyKey = null,
}) => {
  let vendors = [];
  if (vendorId) {
    const resolvedVendorId = decodeSecureId(vendorId, "vendor", { strict: false });
    const vendor = await Vendor.findById(resolvedVendorId);
    if (!vendor) throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
    vendors = [vendor];
  } else {
    vendors = await Vendor.find({ status: "approved", isActive: true });
  }

  const generated = [];

  for (const vendor of vendors) {
    const calc = await calculateVendorEligibleSettlement({ vendorId: vendor._id });
    if (calc.eligibleOrders.length === 0 || calc.netPayable <= 0) {
      continue;
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const start = periodStart ? new Date(periodStart) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = periodEnd ? new Date(periodEnd) : new Date();
      const settlementNumber = generateSettlementNumber();
      const eligibleOrderIds = calc.eligibleOrders.map((o) => o._id);

      const [settlement] = await VendorSettlement.create(
        [
          {
            vendorId: vendor._id,
            settlementNumber,
            orderIds: eligibleOrderIds,
            periodStart: start,
            periodEnd: end,
            currency: "INR",
            grossSales: toDecimal128(calc.grossSales),
            discounts: toDecimal128(calc.discounts),
            refunds: toDecimal128(calc.refunds),
            platformCommission: toDecimal128(calc.platformCommission),
            netPayable: toDecimal128(calc.netPayable),
            status: "pending",
            idempotencyKey: idempotencyKey ? `${idempotencyKey}_${vendor._id}` : `stl_${vendor._id}_${Date.now()}`,
          },
        ],
        { session }
      );

      for (const order of calc.eligibleOrders) {
        let modified = false;
        for (const item of (order.items || [])) {
          if (item.vendorId && item.vendorId.toString() === vendor._id.toString() && !item.settlementId) {
            item.settlementId = settlement._id;
            modified = true;
          }
        }
        if (modified) {
          await Order.updateOne(
            { _id: order._id },
            { $set: { items: order.items } },
            { session }
          );
        }
      }

      await session.commitTransaction();

      const AuditLog = require("../models/AuditLog");
      await AuditLog.create({
        actorId: adminUserId || vendor.userId,
        targetId: settlement._id,
        action: "SETTLEMENT_GENERATED",
        entityType: "vendor_settlement",
        afterState: {
          settlementNumber: settlement.settlementNumber,
          netPayable: calc.netPayable,
          orderCount: eligibleOrderIds.length,
        },
      }).catch(() => {});

      generated.push(settlement);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  return generated;
};

const getVendorFinanceSummary = async ({ userId }) => {
  const vendor = await resolveApprovedVendor(userId);
  const settlements = await vendorSettlementRepository.findByVendorId(vendor._id);

  let totalEarningsNum = 0;
  let pendingSettlementNum = 0;

  for (const s of settlements) {
    const amount = Number(s.netPayable?.toString() || "0");
    if (s.status === "paid") {
      totalEarningsNum += amount;
    } else if (["pending", "eligible", "processing", "payable"].includes(s.status)) {
      pendingSettlementNum += amount;
    }
  }

  const eligibleCalc = await calculateVendorEligibleSettlement({ vendorId: vendor._id });

  return {
    currency: "INR",
    commissionRate: Number(vendor.commissionRate?.toString() || "0.10"),
    totalEarnings: totalEarningsNum.toFixed(2),
    pendingSettlement: pendingSettlementNum.toFixed(2),
    eligibleForSettlement: eligibleCalc.netPayable.toFixed(2),
    eligibleOrdersCount: eligibleCalc.eligibleOrders.length,
    settlementCount: settlements.length,
    recentSettlements: settlements.slice(0, 5).map((s) => ({
      _id: s._id,
      secureId: encodeSecureId("settlement", s._id),
      settlementNumber: s.settlementNumber,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      grossSales: s.grossSales?.toString(),
      discounts: s.discounts?.toString(),
      refunds: s.refunds?.toString(),
      platformCommission: s.platformCommission?.toString(),
      netPayable: s.netPayable?.toString(),
      status: s.status,
      paidAt: s.paidAt,
      createdAt: s.createdAt,
    })),
  };
};

const markSettlementPaid = async ({
  settlementId,
  payoutReference,
  notes = null,
  adminUserId = null,
  ipAddress = null,
  userAgent = null,
}) => {
  const resolvedSettlementId = decodeSecureId(settlementId, "settlement", { strict: false });
  const settlement = await VendorSettlement.findById(resolvedSettlementId);
  if (!settlement) {
    throw new AppError("Settlement record not found", 404, "SETTLEMENT_NOT_FOUND");
  }

  if (settlement.status === "paid") {
    return settlement;
  }

  const beforeStatus = settlement.status;
  settlement.status = "paid";
  settlement.paidAt = new Date();
  settlement.payoutReference = payoutReference || `PAY-${Date.now()}`;
  settlement.settledBy = adminUserId;

  const saved = await settlement.save();

  const AuditLog = require("../models/AuditLog");
  await AuditLog.create({
    actorId: adminUserId || settlement.vendorId,
    targetId: settlement._id,
    action: "SETTLEMENT_PAID",
    entityType: "vendor_settlement",
    beforeState: { status: beforeStatus },
    afterState: {
      status: settlement.status,
      paidAt: settlement.paidAt,
      payoutReference: settlement.payoutReference,
    },
    ipAddress,
    userAgent,
  }).catch(() => {});

  return saved;
};

const getMyVendorSettlementById = async ({ userId, settlementId }) => {
  const vendor = await resolveApprovedVendor(userId);
  const resolvedSettlementId = decodeSecureId(settlementId, "settlement", { strict: true });

  const settlement = await VendorSettlement.findById(resolvedSettlementId)
    .populate("orderIds", "orderNumber status placedAt grandTotal currency")
    .lean();

  if (!settlement) {
    throw new AppError("Settlement record not found", 404, "SETTLEMENT_NOT_FOUND");
  }

  if (settlement.vendorId.toString() !== vendor._id.toString()) {
    throw new AppError("You do not have permission to view this settlement", 403, "FORBIDDEN");
  }

  return {
    ...settlement,
    secureId: encodeSecureId("settlement", settlement._id),
    grossSales: settlement.grossSales?.toString(),
    discounts: settlement.discounts?.toString(),
    refunds: settlement.refunds?.toString(),
    platformCommission: settlement.platformCommission?.toString(),
    netPayable: settlement.netPayable?.toString(),
  };
};

const getAdminSettlements = async ({ query = {} }) => {
  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }
  if (query.vendorId) {
    const resolvedVendorId = decodeSecureId(query.vendorId, "vendor", { strict: false });
    filter.vendorId = resolvedVendorId;
  }
  if (query.search) {
    filter.settlementNumber = { $regex: query.search.trim(), $options: "i" };
  }

  const { items, total } = await vendorSettlementRepository.findAll({
    filter,
    skip,
    limit: safeLimit,
    sort: { createdAt: -1 },
  });

  const projected = items.map((s) => ({
    ...s,
    secureId: encodeSecureId("settlement", s._id),
    grossSales: s.grossSales?.toString(),
    discounts: s.discounts?.toString(),
    refunds: s.refunds?.toString(),
    platformCommission: s.platformCommission?.toString(),
    netPayable: s.netPayable?.toString(),
  }));

  return {
    items: projected,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

const getAdminSettlementById = async (settlementId) => {
  const resolvedSettlementId = decodeSecureId(settlementId, "settlement", { strict: false });
  const settlement = await VendorSettlement.findById(resolvedSettlementId)
    .populate("vendorId", "businessName storeName businessSlug email phone bankAccount")
    .populate("orderIds", "orderNumber status placedAt grandTotal currency items shippingAddress")
    .populate("settledBy", "name email")
    .lean();

  if (!settlement) {
    throw new AppError("Settlement record not found", 404, "SETTLEMENT_NOT_FOUND");
  }

  return {
    ...settlement,
    secureId: encodeSecureId("settlement", settlement._id),
    grossSales: settlement.grossSales?.toString(),
    discounts: settlement.discounts?.toString(),
    refunds: settlement.refunds?.toString(),
    platformCommission: settlement.platformCommission?.toString(),
    netPayable: settlement.netPayable?.toString(),
  };
};

const getMyVendorSettlements = async ({ userId, query = {} }) => {
  const vendor = await resolveApprovedVendor(userId);
  const settlements = await vendorSettlementRepository.findByVendorId(vendor._id);

  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  let filtered = settlements;
  if (query.status) {
    filtered = filtered.filter((s) => s.status === query.status);
  }

  const paginated = filtered.slice(skip, skip + safeLimit).map((s) => {
    const obj = s.toObject ? s.toObject() : s;
    return {
      ...obj,
      secureId: encodeSecureId("settlement", obj._id),
      grossSales: obj.grossSales?.toString(),
      discounts: obj.discounts?.toString(),
      refunds: obj.refunds?.toString(),
      platformCommission: obj.platformCommission?.toString(),
      netPayable: obj.netPayable?.toString(),
    };
  });

  return {
    items: paginated,
    meta: {
      page: safePage,
      limit: safeLimit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / safeLimit),
    },
  };
};

module.exports = {
  createSettlement,
  getSettlementById,
  getSettlementsByVendorId,
  getMyVendorSettlements,
  getMyVendorSettlementById,
  calculateVendorEligibleSettlement,
  generateEligibleSettlements,
  getVendorFinanceSummary,
  markSettlementPaid,
  getAdminSettlements,
  getAdminReturnById: getAdminSettlementById,
  getAdminSettlementById,
  markProcessing,
  markPayable,
  calculateNetPayable,
  generateSettlementNumber,
};