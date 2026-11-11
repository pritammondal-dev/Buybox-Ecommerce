const mongoose = require("mongoose");

const { VendorSettlement } = require("../models/VendorSettlement");
const VendorBankAccount = require("../models/VendorBankAccount");
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
  platformSubsidy = "0.00",
  discounts,
  refunds,
  platformCommission,
}) => {
  const gross = decimalToNumber(grossSales);
  const subsidy = decimalToNumber(platformSubsidy);
  const discount = decimalToNumber(discounts);
  const refund = decimalToNumber(refunds);
  const commission = decimalToNumber(platformCommission);

  const net = gross + subsidy - discount - refund - commission;

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
  platformSubsidy = "0.00",
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
    platformSubsidy,
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
          platformSubsidy: toDecimal128(platformSubsidy),
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

  // 1. Validate Vendor Active & Onboarding Eligibility
  if (
    !vendor.isActive ||
    (vendor.onboardingStatus && vendor.onboardingStatus !== "approved") ||
    vendor.onboardingStatus === "suspended" ||
    vendor.onboardingStatus === "rejected"
  ) {
    return {
      vendorId: vendor._id,
      currency: "INR",
      grossSales: 0,
      platformSubsidy: 0,
      discounts: 0,
      refunds: 0,
      platformCommission: 0,
      netPayable: 0,
      hasItemSnapshots: false,
      eligibleOrders: [],
      eligibleItems: [],
      ineligibleReason: "VENDOR_NOT_ELIGIBLE",
    };
  }

  // 2. Validate Wallet Status (must not be frozen or suspended)
  const VendorWallet = require("../models/VendorWallet");
  const { WALLET_STATUSES } = require("../constants/finance.constants");
  const wallet = await VendorWallet.findOne({ vendorId: vendor._id, currency: "INR" });
  if (
    wallet &&
    [WALLET_STATUSES.FROZEN, WALLET_STATUSES.SUSPENDED, WALLET_STATUSES.CLOSED].includes(wallet.status)
  ) {
    return {
      vendorId: vendor._id,
      currency: "INR",
      grossSales: 0,
      platformSubsidy: 0,
      discounts: 0,
      refunds: 0,
      platformCommission: 0,
      netPayable: 0,
      hasItemSnapshots: false,
      eligibleOrders: [],
      eligibleItems: [],
      ineligibleReason: `WALLET_${String(wallet.status).toUpperCase()}`,
    };
  }

  // 3. Resolve Authoritative Return Window Policy from StorefrontSettings
  const storefrontSettingsService = require("./storefront-settings.service");
  const activeSettings = await storefrontSettingsService.getActiveSettings().catch(() => null);
  const globalReturnWindowDays = (
    activeSettings?.policies?.returnWindowDays &&
    Number.isInteger(activeSettings.policies.returnWindowDays) &&
    activeSettings.policies.returnWindowDays >= 1 &&
    activeSettings.policies.returnWindowDays <= 90
  ) ? activeSettings.policies.returnWindowDays : 7;

  // 4. Query candidate delivered/completed orders with payment verified
  // STRICT: Delivery timestamp must be present (exclude undelivered or estimated orders)
  const deliveredOrders = await Order.find({
    status: { $in: ["delivered", "completed"] },
    paymentStatus: { $in: ["paid", "partially_refunded"] },
    "items.vendorId": vendor._id,
    deliveredAt: { $ne: null, $exists: true },
  }).lean();

  const candidateOrderIds = deliveredOrders.map((o) => o._id);
  const activeReturns = candidateOrderIds.length > 0
    ? await ReturnRequest.find({
        orderId: { $in: candidateOrderIds },
        status: {
          $in: [
            "requested",
            "under_review",
            "approved",
            "pickup_scheduled",
            "received",
            "inspected",
            "refund_pending",
          ],
        },
      }).lean()
    : [];

  let grossSalesNum = 0;
  let platformSubsidyNum = 0;
  let discountsNum = 0;
  let refundsNum = 0;
  let platformCommissionMinor = 0;
  let hasItemSnapshots = false;

  const eligibleOrders = [];
  const eligibleItems = [];

  for (const order of deliveredOrders) {
    if (!order.deliveredAt) continue;

    const orderDeliveryDate = new Date(order.deliveredAt);
    if (Number.isNaN(orderDeliveryDate.getTime())) continue;

    // Preserve applicable return policy snapshot if present; fallback to max(7, globalReturnWindowDays)
    const applicableWindowDays = (
      order.returnWindowDaysSnapshot &&
      Number.isInteger(order.returnWindowDaysSnapshot) &&
      order.returnWindowDaysSnapshot >= 1
    ) ? order.returnWindowDaysSnapshot : Math.max(7, globalReturnWindowDays);

    const maturityCutoff = new Date(orderDeliveryDate.getTime() + applicableWindowDays * 24 * 60 * 60 * 1000);
    if (new Date() < maturityCutoff) {
      // Order is still within active return window hold
      continue;
    }

    let orderHasEligibleItems = false;
    for (const item of (order.items || [])) {
      if (
        item.vendorId &&
        item.vendorId.toString() === vendor._id.toString() &&
        !item.settlementId &&
        item.fulfillmentStatus !== "cancelled"
      ) {
        // Check if item is subject to active return hold
        const isItemOnReturnHold = activeReturns.some(
          (ret) => ret.orderId.toString() === order._id.toString() &&
            (ret.items || []).some(
              (ri) => ri.productId?.toString() === item.productId?.toString() &&
                (!ri.productVariantId || ri.productVariantId?.toString() === item.productVariantId?.toString())
            )
        );

        if (isItemOnReturnHold) {
          continue; // Held from settlement until buyer return request resolves
        }

        orderHasEligibleItems = true;
        const lineTotal = Number(
          item.lineTotal?.toString() ||
            (item.quantity * Number(item.unitPrice?.toString() || 0))
        );
        grossSalesNum += lineTotal;

        let itemPlatformSubsidy = 0;
        if (
          item.isPromotional &&
          item.fundingSource === "platform" &&
          item.promotionDiscountAmount != null
        ) {
          const promoDiscountPerUnit = Number(item.promotionDiscountAmount?.toString() || 0);
          itemPlatformSubsidy = promoDiscountPerUnit * (item.quantity || 1);
          platformSubsidyNum += itemPlatformSubsidy;
        }

        // Phase VW-02: Check for immutable commission snapshot on order item
        let itemCommissionAmount = null;
        let itemCommissionRate = null;
        if (
          item.commissionSnapshot &&
          (item.commissionSnapshot.isLocked || item.commissionSnapshot.commissionAmount != null)
        ) {
          hasItemSnapshots = true;
          itemCommissionAmount = Number(item.commissionSnapshot.commissionAmount.toString());
          itemCommissionRate = Number(item.commissionSnapshot.commissionRate.toString());
          platformCommissionMinor += Math.round(itemCommissionAmount * 100);
        } else if (item.commissionAmount != null) {
          hasItemSnapshots = true;
          itemCommissionAmount = Number(item.commissionAmount.toString());
          itemCommissionRate = Number(item.commissionRate?.toString() || 0.10);
          platformCommissionMinor += Math.round(itemCommissionAmount * 100);
        }

        eligibleItems.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          productId: item.productId,
          productVariantId: item.productVariantId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice?.toString(),
          lineTotal: lineTotal.toFixed(2),
          isPromotional: Boolean(item.isPromotional),
          fundingSource: item.fundingSource || "none",
          promotionId: item.promotionId,
          promotionName: item.promotionName,
          platformSubsidy: itemPlatformSubsidy.toFixed(2),
          commissionRate: itemCommissionRate,
          commissionAmount: itemCommissionAmount !== null ? itemCommissionAmount.toFixed(2) : null,
          hasSnapshot: itemCommissionAmount !== null,
        });
      }
    }
    if (orderHasEligibleItems) {
      eligibleOrders.push(order);
    }
  }

  let rate = Number(vendor.commissionRate?.toString() || "0");
  if (rate > 1) {
    rate = rate / 100;
  } else if (rate <= 0) {
    rate = 0.10;
  }

  if (eligibleOrders.length > 0) {
    const orderIds = eligibleOrders.map((o) => o._id);
    const completedReturns = await ReturnRequest.find({
      orderId: { $in: orderIds },
      status: { $in: ["refunded"] },
    }).lean();

    for (const ret of completedReturns) {
      for (const item of (ret.items || [])) {
        if (item.vendorId && item.vendorId.toString() === vendor._id.toString()) {
          const returnTotal = item.customerPaidAmount
            ? Number(item.customerPaidAmount.toString())
            : Number(item.itemPrice?.toString() || 0) * (item.quantity || 1);
          refundsNum += returnTotal;

          // Find parent order item to check snapshot rate
          const parentOrder = eligibleOrders.find((o) => o._id.toString() === ret.orderId.toString());
          let retRate = rate;
          if (parentOrder) {
            const orderItem = (parentOrder.items || []).find(
              (oi) =>
                oi.productId?.toString() === item.productId?.toString() &&
                (!item.productVariantId || oi.productVariantId?.toString() === item.productVariantId?.toString())
            );
            if (orderItem) {
              if (orderItem.commissionSnapshot?.commissionRate) {
                retRate = Number(orderItem.commissionSnapshot.commissionRate.toString());
              } else if (orderItem.commissionRate) {
                retRate = Number(orderItem.commissionRate.toString());
              }

              // Reverse platform subsidy for returned quantity if item was platform-funded
              if (
                orderItem.isPromotional &&
                orderItem.fundingSource === "platform" &&
                orderItem.promotionDiscountAmount != null
              ) {
                const promoDiscountPerUnit = Number(orderItem.promotionDiscountAmount?.toString() || 0);
                const subsidyReversal = promoDiscountPerUnit * retQty;
                platformSubsidyNum = Math.max(0, platformSubsidyNum - subsidyReversal);
              }
            }
          }

          // If items had snapshots, reverse returned item's commission proportionally
          if (hasItemSnapshots) {
            const reversedCommMinor = Math.round(returnTotal * retRate * 100);
            platformCommissionMinor = Math.max(0, platformCommissionMinor - reversedCommMinor);
          }
        }
      }
    }
  }

  // Contractual base in integer minor units (cents/paisa) to prevent floating-point drift
  const grossSalesMinor = Math.round(grossSalesNum * 100);
  const platformSubsidyMinor = Math.round(platformSubsidyNum * 100);
  const discountsMinor = Math.round(discountsNum * 100);
  const refundsMinor = Math.round(refundsNum * 100);

  const commissionBaseMinor = Math.max(
    0,
    grossSalesMinor + platformSubsidyMinor - discountsMinor - refundsMinor
  );

  let finalCommissionMinor;
  if (hasItemSnapshots) {
    // Exact summation of stored immutable snapshots
    finalCommissionMinor = Math.min(platformCommissionMinor, commissionBaseMinor);
  } else {
    // Legacy fallback for orders placed before VW-02 without snapshots
    finalCommissionMinor = Math.round(commissionBaseMinor * rate);
  }

  const netPayableMinor = Math.max(0, commissionBaseMinor - finalCommissionMinor);

  return {
    vendorId: vendor._id,
    currency: "INR",
    commissionRate: rate,
    grossSales: grossSalesMinor / 100,
    platformSubsidy: platformSubsidyMinor / 100,
    discounts: discountsMinor / 100,
    refunds: refundsMinor / 100,
    platformCommission: finalCommissionMinor / 100,
    netPayable: netPayableMinor / 100,
    hasItemSnapshots,
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
  batchSize = 50,
  limit = null,
} = {}) => {
  let vendors = [];
  if (vendorId) {
    const resolvedVendorId = decodeSecureId(vendorId, "vendor", { strict: false });
    const vendor = await Vendor.findById(resolvedVendorId);
    if (!vendor) throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
    vendors = [vendor];
  } else {
    const maxVendors = Number(limit) || Number(batchSize) || 50;
    vendors = await Vendor.find({
      $or: [{ onboardingStatus: "approved" }, { status: "approved" }],
      isActive: true,
    }).limit(maxVendors);
  }

  const generated = [];
  const failures = [];

  for (const vendor of vendors) {
    try {
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

        const vendorIdempotencyKey = idempotencyKey
          ? `${idempotencyKey}_${vendor._id}`
          : `stl_${vendor._id}_${Date.now()}`;

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
              platformSubsidy: toDecimal128(calc.platformSubsidy || 0),
              discounts: toDecimal128(calc.discounts),
              refunds: toDecimal128(calc.refunds),
              platformCommission: toDecimal128(calc.platformCommission),
              netPayable: toDecimal128(calc.netPayable),
              status: "pending",
              idempotencyKey: vendorIdempotencyKey,
            },
          ],
          { session }
        );

        // Record FinancialLedger entries for platform-funded promotional subsidies
        const FinancialLedgerEntry = require("../models/FinancialLedgerEntry");
        const {
          FINANCIAL_ENTRY_TYPES,
          FINANCIAL_ENTRY_DIRECTIONS,
          FINANCIAL_ACCOUNT_TYPES,
          FINANCIAL_ENTRY_SOURCES,
        } = require("../constants/finance.constants");

        const ledgerEntries = [];
        for (const item of (calc.eligibleItems || [])) {
          const itemSubsidy = Number(item.platformSubsidy || 0);
          if (itemSubsidy > 0 && item.fundingSource === "platform") {
            // Vendor Credit entry
            ledgerEntries.push({
              journalId: settlement.settlementNumber,
              entryType: FINANCIAL_ENTRY_TYPES.PROMOTION_SUBSIDY,
              direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
              accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
              accountReference: vendor._id.toString(),
              amount: toDecimal128(itemSubsidy),
              currency: "INR",
              orderId: item.orderId,
              settlementId: settlement._id,
              vendorId: vendor._id,
              idempotencyKey: `sub_credit_${settlement._id}_${item.orderId}_${item.productId}`,
              description: `Platform promotion subsidy credit for ${item.productName || "item"} (${item.promotionName || "Promotion"})`,
              source: FINANCIAL_ENTRY_SOURCES.SYSTEM,
              metadata: {
                orderNumber: item.orderNumber || "",
                productId: item.productId?.toString() || "",
                promotionId: item.promotionId?.toString() || "",
                promotionName: item.promotionName || "",
                fundingSource: "platform",
                quantity: String(item.quantity || 1),
              },
            });

            // Platform Debit entry
            ledgerEntries.push({
              journalId: settlement.settlementNumber,
              entryType: FINANCIAL_ENTRY_TYPES.PROMOTION_SUBSIDY,
              direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
              accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
              accountReference: "BUYBOX_MARKETING_PROMOTIONS",
              amount: toDecimal128(itemSubsidy),
              currency: "INR",
              orderId: item.orderId,
              settlementId: settlement._id,
              vendorId: vendor._id,
              idempotencyKey: `sub_debit_${settlement._id}_${item.orderId}_${item.productId}`,
              description: `Platform promotion subsidy expense for Order #${item.orderNumber || item.orderId}`,
              source: FINANCIAL_ENTRY_SOURCES.SYSTEM,
              metadata: {
                orderNumber: item.orderNumber || "",
                productId: item.productId?.toString() || "",
                promotionId: item.promotionId?.toString() || "",
                promotionName: item.promotionName || "",
                fundingSource: "platform",
                quantity: String(item.quantity || 1),
              },
            });
          }
        }

        if (ledgerEntries.length > 0) {
          await FinancialLedgerEntry.insertMany(ledgerEntries, { session });
        }

        // Phase VW-03: Post settlement maturation double-entry journal (reclassifying pending to available)
        const financialLedgerService = require("./financial-ledger.service");
        await financialLedgerService.postSettlementMaturationJournal(settlement, { session });

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
        await AuditLog.create([
          {
            actorId: adminUserId || vendor.userId || vendor._id,
            targetId: settlement._id,
            action: "SETTLEMENT_GENERATED",
            entityType: "vendor_settlement",
            afterState: {
              settlementNumber: settlement.settlementNumber,
              netPayable: calc.netPayable,
              orderCount: eligibleOrderIds.length,
            },
          },
        ]).catch(() => {});

        generated.push(settlement);
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        if (vendorId) {
          throw err;
        } else {
          const logger = require("../config/logger");
          logger.error({ err: err.message, vendorId: vendor._id }, "Failed generating settlement for vendor in batch");
          failures.push({ vendorId: vendor._id, error: err.message });
        }
      } finally {
        await session.endSession().catch(() => {});
      }
    } catch (vendorErr) {
      if (vendorId) {
        throw vendorErr;
      } else {
        const logger = require("../config/logger");
        logger.error({ err: vendorErr.message, vendorId: vendor._id }, "Error evaluating settlement eligibility for vendor");
        failures.push({ vendorId: vendor._id, error: vendorErr.message });
      }
    }
  }

  generated.failures = failures;
  generated.summary = {
    totalVendorsEvaluated: vendors.length,
    settlementsGenerated: generated.length,
    totalMaturedAmount: generated.reduce((sum, s) => sum + Number(s.netPayable?.toString() || 0), 0).toFixed(2),
    failureCount: failures.length,
  };

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
    commissionRate: await (async () => {
      try {
        const commissionService = require("./commission.service");
        const activePolicy = await commissionService.resolveCommissionPolicy({ vendorId: vendor._id });
        return Number(activePolicy.rate.toString());
      } catch {
        return Number(vendor.commissionRate?.toString() || "0.10");
      }
    })(),
    totalEarnings: totalEarningsNum.toFixed(2),
    pendingSettlement: pendingSettlementNum.toFixed(2),
    eligibleForSettlement: eligibleCalc.netPayable.toFixed(2),
    eligibleOrdersCount: eligibleCalc.eligibleOrders.length,
    settlementCount: settlements.length,
    wallet: await (async () => {
      try {
        const vendorWalletService = require("./vendor-wallet.service");
        return await vendorWalletService.getVendorWallet(vendor._id);
      } catch {
        return null;
      }
    })(),
    recentSettlements: settlements.slice(0, 5).map((s) => ({
      _id: s._id,
      secureId: encodeSecureId("settlement", s._id),
      settlementNumber: s.settlementNumber,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      grossSales: s.grossSales?.toString(),
      platformSubsidy: s.platformSubsidy?.toString() || "0.00",
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

  if (settlement.vendorId && !settlement.vendorId.bankAccount) {
    const activeBank = await VendorBankAccount.findOne({
      vendorId: settlement.vendorId._id,
      isActive: true,
      status: "approved",
      deletedAt: null,
    }).lean();

    if (activeBank) {
      settlement.vendorId.bankAccount = activeBank;
    }
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
  const resolvedSettlementId = decodeSecureId(settlementId, "settlement", { strict: false });

  const settlement = await VendorSettlement.findById(resolvedSettlementId)
    .populate("orderIds", "orderNumber status placedAt grandTotal currency")
    .lean();

  if (!settlement) {
    throw new AppError("Settlement record not found", 404, "SETTLEMENT_NOT_FOUND");
  }

  if (settlement.vendorId.toString() !== vendor._id.toString()) {
    throw new AppError("You do not have permission to view this settlement", 403, "FORBIDDEN");
  }

  let payoutDestination = null;
  try {
    const VendorPayout = mongoose.model("VendorPayout");
    const payout = await VendorPayout.findOne({ settlementId: settlement._id }).lean();
    if (payout) {
      const pMeta = payout.metadata instanceof Map ? Object.fromEntries(payout.metadata) : (payout.metadata || {});
      payoutDestination = {
        bankAccountId: payout.bankAccountId || pMeta.bankAccountId || null,
        bankName: pMeta.bankName || null,
        accountHolderName: pMeta.accountHolderName || pMeta.beneficiaryName || null,
        accountNumberMasked: pMeta.accountNumberMasked || null,
        ifscCode: pMeta.ifscCode || null,
        accountType: pMeta.accountType || null,
        snapshotAt: pMeta.snapshotAt || payout.createdAt,
        status: payout.status,
        payoutNumber: payout.payoutNumber,
      };
    }
  } catch (err) {}

  return {
    ...settlement,
    payoutDestination,
    secureId: encodeSecureId("settlement", settlement._id),
    grossSales: settlement.grossSales?.toString(),
    platformSubsidy: settlement.platformSubsidy?.toString() || "0.00",
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
    platformSubsidy: s.platformSubsidy?.toString() || "0.00",
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

  let payout = null;
  let payoutDestination = null;
  try {
    const VendorPayout = mongoose.model("VendorPayout");
    payout = await VendorPayout.findOne({ settlementId: settlement._id }).lean();
    if (payout) {
      const pMeta = payout.metadata instanceof Map ? Object.fromEntries(payout.metadata) : (payout.metadata || {});
      payoutDestination = {
        bankAccountId: payout.bankAccountId || pMeta.bankAccountId || null,
        bankName: pMeta.bankName || null,
        accountHolderName: pMeta.accountHolderName || pMeta.beneficiaryName || null,
        accountNumberMasked: pMeta.accountNumberMasked || null,
        ifscCode: pMeta.ifscCode || null,
        accountType: pMeta.accountType || null,
        snapshotAt: pMeta.snapshotAt || payout.createdAt,
        status: payout.status,
        payoutNumber: payout.payoutNumber,
        provider: payout.provider,
        providerReference: payout.providerReference,
        paidAt: payout.paidAt,
      };
    }
  } catch (err) {}

  const actualVendorId = settlement.vendorId?._id || settlement.vendorId;
  let currentActiveBank = null;
  try {
    currentActiveBank = await VendorBankAccount.findOne({
      vendorId: actualVendorId,
      isActive: true,
      status: "approved",
      deletedAt: null,
    }).lean();
  } catch (err) {}

  const effectiveBankAccount = payoutDestination || (currentActiveBank ? {
    ...currentActiveBank,
    accountNumber: currentActiveBank.accountNumberMasked,
  } : null);

  const vendorObj = settlement.vendorId && typeof settlement.vendorId === "object" ? {
    ...settlement.vendorId,
    bankAccount: effectiveBankAccount,
  } : settlement.vendorId;

  return {
    ...settlement,
    vendorId: vendorObj,
    payout: payout ? {
      _id: payout._id,
      payoutNumber: payout.payoutNumber,
      status: payout.status,
      amount: payout.amount?.toString(),
      currency: payout.currency,
      provider: payout.provider,
      providerReference: payout.providerReference,
      retryCount: payout.retryCount,
      failureReason: payout.failureReason,
      processedAt: payout.processedAt,
      paidAt: payout.paidAt,
      cancelledAt: payout.cancelledAt,
    } : null,
    payoutDestination,
    currentActiveBank: currentActiveBank ? {
      _id: currentActiveBank._id,
      bankName: currentActiveBank.bankName,
      accountHolderName: currentActiveBank.accountHolderName,
      accountNumberMasked: currentActiveBank.accountNumberMasked,
      ifscCode: currentActiveBank.ifscCode,
      accountType: currentActiveBank.accountType,
    } : null,
    secureId: encodeSecureId("settlement", settlement._id),
    grossSales: settlement.grossSales?.toString(),
    platformSubsidy: settlement.platformSubsidy?.toString() || "0.00",
    discounts: settlement.discounts?.toString(),
    refunds: settlement.refunds?.toString(),
    platformCommission: settlement.platformCommission?.toString(),
    netPayable: settlement.netPayable?.toString(),
  };
};

const getMyVendorSettlements = async ({ userId, query = {} }) => {
  const vendor = await resolveApprovedVendor(userId);

  const paginatedResult = await vendorSettlementRepository.findPaginatedByVendor({
    vendorId: vendor._id,
    page: query.page,
    limit: query.limit,
    status: query.status,
    startDate: query.startDate,
    endDate: query.endDate,
    search: query.search,
  });

  const serializedItems = paginatedResult.items.map((s) => {
    const obj = s.toObject ? s.toObject() : s;
    return {
      ...obj,
      secureId: encodeSecureId("settlement", obj._id),
      grossSales: obj.grossSales?.toString() || "0.00",
      platformSubsidy: obj.platformSubsidy?.toString() || "0.00",
      discounts: obj.discounts?.toString() || "0.00",
      refunds: obj.refunds?.toString() || "0.00",
      platformCommission: obj.platformCommission?.toString() || "0.00",
      netPayable: obj.netPayable?.toString() || "0.00",
    };
  });

  return {
    items: serializedItems,
    summary: paginatedResult.summary,
    meta: {
      page: paginatedResult.page,
      limit: paginatedResult.limit,
      total: paginatedResult.total,
      totalPages: paginatedResult.totalPages,
      summary: paginatedResult.summary,
    },
  };
};

const getPromotionSubsidyReconciliation = async ({
  vendorId = null,
  startDate = null,
  endDate = null,
} = {}) => {
  const FinancialLedgerEntry = require("../models/FinancialLedgerEntry");
  const { FINANCIAL_ENTRY_TYPES, FINANCIAL_ENTRY_DIRECTIONS } = require("../constants/finance.constants");

  const orderQuery = {
    paymentStatus: { $in: ["paid", "partially_refunded"] },
    status: { $nin: ["cancelled", "failed"] },
  };

  if (vendorId) {
    const resolvedVendorId = decodeSecureId(vendorId, "vendor", { strict: false });
    orderQuery["items.vendorId"] = resolvedVendorId;
  }
  if (startDate || endDate) {
    orderQuery.createdAt = {};
    if (startDate) orderQuery.createdAt.$gte = new Date(startDate);
    if (endDate) orderQuery.createdAt.$lte = new Date(endDate);
  }

  const orders = await Order.find(orderQuery).lean();

  let platformDiscountTotal = 0;
  let vendorDiscountTotal = 0;
  let missingFundingSourceCount = 0;
  let totalPromotionalItems = 0;

  for (const order of orders) {
    for (const item of (order.items || [])) {
      if (item.isPromotional) {
        totalPromotionalItems += 1;
        const discountPerUnit = Number(item.promotionDiscountAmount?.toString() || 0);
        const qty = item.quantity || 1;
        const itemDiscountTotal = discountPerUnit * qty;

        if (item.fundingSource === "platform") {
          platformDiscountTotal += itemDiscountTotal;
        } else if (item.fundingSource === "vendor") {
          vendorDiscountTotal += itemDiscountTotal;
        } else {
          missingFundingSourceCount += 1;
        }
      }
    }
  }

  const settlementQuery = {};
  if (vendorId) {
    settlementQuery.vendorId = decodeSecureId(vendorId, "vendor", { strict: false });
  }
  const settlements = await VendorSettlement.find(settlementQuery).lean();

  let platformSubsidiesSettled = 0;
  for (const s of settlements) {
    platformSubsidiesSettled += Number(s.platformSubsidy?.toString() || 0);
  }

  const ledgerQuery = {
    entryType: FINANCIAL_ENTRY_TYPES.PROMOTION_SUBSIDY,
    direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
  };
  if (vendorId) {
    ledgerQuery.vendorId = decodeSecureId(vendorId, "vendor", { strict: false });
  }
  const ledgerEntries = await FinancialLedgerEntry.find(ledgerQuery).lean();

  let subsidyLedgerCredits = 0;
  for (const entry of ledgerEntries) {
    subsidyLedgerCredits += Number(entry.amount?.toString() || 0);
  }

  const reversalQuery = {
    entryType: FINANCIAL_ENTRY_TYPES.SUBSIDY_REVERSAL,
  };
  if (vendorId) {
    reversalQuery.vendorId = decodeSecureId(vendorId, "vendor", { strict: false });
  }
  const reversalEntries = await FinancialLedgerEntry.find(reversalQuery).lean();
  let subsidyReversals = 0;
  for (const rev of reversalEntries) {
    subsidyReversals += Number(rev.amount?.toString() || 0);
  }

  const outstandingSubsidies = Math.max(0, platformDiscountTotal - platformSubsidiesSettled);
  const reconciliationDifference = Math.abs(subsidyLedgerCredits - platformSubsidiesSettled);
  const isReconciled = reconciliationDifference < 0.01;

  return {
    currency: "INR",
    platformDiscountTotal: Number(platformDiscountTotal.toFixed(2)),
    vendorDiscountTotal: Number(vendorDiscountTotal.toFixed(2)),
    platformSubsidiesSettled: Number(platformSubsidiesSettled.toFixed(2)),
    subsidyLedgerCredits: Number(subsidyLedgerCredits.toFixed(2)),
    subsidyReversals: Number(subsidyReversals.toFixed(2)),
    outstandingSubsidies: Number(outstandingSubsidies.toFixed(2)),
    settlementBatchCount: settlements.length,
    totalPromotionalItems,
    missingFundingSourceCount,
    reconciliationDifference: Number(reconciliationDifference.toFixed(2)),
    isReconciled,
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
  getPromotionSubsidyReconciliation,
  markProcessing,
  markPayable,
  calculateNetPayable,
  generateSettlementNumber,
};