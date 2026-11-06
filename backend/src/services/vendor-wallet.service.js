const mongoose = require("mongoose");
const VendorWallet = require("../models/VendorWallet");
const financialLedgerRepository = require("../repositories/financial-ledger.repository");
const financialLedgerService = require("./financial-ledger.service");
const AppError = require("../errors/AppError");

const formatWalletResponse = (wallet, recentEntries = []) => {
  return {
    walletId: wallet._id,
    vendorId: wallet.vendorId,
    currency: wallet.currency,
    status: wallet.status,
    pendingBalance: wallet.pendingBalance?.toString() || "0.00",
    availableBalance: wallet.availableBalance?.toString() || "0.00",
    reservedBalance: wallet.reservedBalance?.toString() || "0.00",
    totalEarned: wallet.totalEarned?.toString() || "0.00",
    totalCommission: wallet.totalCommission?.toString() || "0.00",
    totalPaidOut: wallet.totalPaidOut?.toString() || "0.00",
    totalRefunded: wallet.totalRefunded?.toString() || "0.00",
    lastSequence: wallet.lastSequence || 0,
    lastReconciledAt: wallet.lastReconciledAt,
    lastReconciliationStatus: wallet.lastReconciliationStatus,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
    recentTransactions: recentEntries.map((e) => ({
      id: e._id,
      journalId: e.journalId,
      entryType: e.entryType,
      direction: e.direction,
      amount: e.amount?.toString() || "0.00",
      currency: e.currency,
      description: e.description,
      orderId: e.orderId,
      settlementId: e.settlementId,
      payoutId: e.payoutId,
      createdAt: e.createdAt,
    })),
  };
};

const getVendorWallet = async (vendorId, currency = "INR") => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  const normalizedCurrency = String(currency || "INR").trim().toUpperCase();

  let wallet = await VendorWallet.findOne({
    vendorId,
    currency: normalizedCurrency,
  });

  if (!wallet) {
    wallet = await financialLedgerService.syncVendorWalletBalances(
      vendorId,
      normalizedCurrency
    );
  }

  const recentEntries = await financialLedgerRepository.findVendorEntries(
    vendorId,
    { limit: 5 }
  );

  return formatWalletResponse(wallet, recentEntries);
};

const getVendorTransactions = async (
  vendorId,
  {
    page = 1,
    limit = 20,
    entryType = null,
    accountCode = null,
    startDate = null,
    endDate = null,
  } = {}
) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const [entries, total] = await Promise.all([
    financialLedgerRepository.findVendorEntries(vendorId, {
      accountCode,
      entryType,
      startDate,
      endDate,
      skip,
      limit: safeLimit,
    }),
    financialLedgerRepository.countVendorEntries(vendorId, {
      accountCode,
      entryType,
      startDate,
      endDate,
    }),
  ]);

  const items = entries.map((e) => ({
    id: e._id,
    journalId: e.journalId,
    entryType: e.entryType,
    direction: e.direction,
    amount: e.amount?.toString() || "0.00",
    currency: e.currency,
    description: e.description,
    orderId: e.orderId,
    settlementId: e.settlementId,
    payoutId: e.payoutId,
    refundId: e.refundId,
    createdAt: e.createdAt,
  }));

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

/**
 * Superadmin list of all vendor wallets with filters and balance projections
 */
const listAdminVendorWallets = async ({
  page = 1,
  limit = 20,
  search = null,
  status = null,
  currency = "INR",
  reconciliationStatus = null,
} = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;
  const normCurrency = String(currency || "INR").trim().toUpperCase();

  const query = { currency: normCurrency };

  if (status) {
    query.status = status;
  }

  if (reconciliationStatus && reconciliationStatus !== "all") {
    query.lastReconciliationStatus = reconciliationStatus;
  }

  const Vendor = require("../models/Vendor");

  if (search && String(search).trim()) {
    const searchRegex = new RegExp(String(search).trim(), "i");
    const matchingVendors = await Vendor.find({
      $or: [
        { businessName: searchRegex },
        { storeName: searchRegex },
        { email: searchRegex },
        { businessSlug: searchRegex },
      ],
    }).select("_id");

    const vendorIds = matchingVendors.map((v) => v._id);
    query.vendorId = { $in: vendorIds };
  }

  const [wallets, total, aggregateSummary] = await Promise.all([
    VendorWallet.find(query)
      .populate("vendorId", "businessName storeName email phone businessSlug isActive onboardingStatus")
      .sort({ availableBalance: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    VendorWallet.countDocuments(query),
    VendorWallet.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAvailable: { $sum: { $toDouble: "$availableBalance" } },
          totalReserved: { $sum: { $toDouble: "$reservedBalance" } },
          totalPending: { $sum: { $toDouble: "$pendingBalance" } },
          totalEarned: { $sum: { $toDouble: "$totalEarned" } },
          totalPaidOut: { $sum: { $toDouble: "$totalPaidOut" } },
        },
      },
    ]),
  ]);

  const items = wallets.map((w) => ({
    _id: w._id,
    id: w._id,
    vendorId: w.vendorId?._id || w.vendorId,
    vendor: w.vendorId || null,
    currency: w.currency,
    status: w.status,
    availableBalance: w.availableBalance?.toString() || "0.00",
    reservedBalance: w.reservedBalance?.toString() || "0.00",
    pendingBalance: w.pendingBalance?.toString() || "0.00",
    totalEarned: w.totalEarned?.toString() || "0.00",
    totalCommission: w.totalCommission?.toString() || "0.00",
    totalPaidOut: w.totalPaidOut?.toString() || "0.00",
    totalRefunded: w.totalRefunded?.toString() || "0.00",
    lastReconciliationStatus: w.lastReconciliationStatus || "pending",
    lastReconciledAt: w.lastReconciledAt || null,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }));

  const summary = aggregateSummary[0] || {
    totalAvailable: 0,
    totalReserved: 0,
    totalPending: 0,
    totalEarned: 0,
    totalPaidOut: 0,
  };

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
    aggregates: {
      totalAvailable: Number(summary.totalAvailable.toFixed(2)),
      totalReserved: Number(summary.totalReserved.toFixed(2)),
      totalPending: Number(summary.totalPending.toFixed(2)),
      totalEarned: Number(summary.totalEarned.toFixed(2)),
      totalPaidOut: Number(summary.totalPaidOut.toFixed(2)),
    },
  };
};

/**
 * Superadmin comprehensive vendor financial drill-down
 */
const getAdminVendorDrilldown = async (vendorId, currency = "INR") => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  const normCurrency = String(currency || "INR").trim().toUpperCase();
  const Vendor = require("../models/Vendor");
  const VendorBankAccount = require("../models/VendorBankAccount");
  const { VendorSettlement } = require("../models/VendorSettlement");
  const VendorPayout = require("../models/VendorPayout");
  const WithdrawalRequest = require("../models/WithdrawalRequest");
  const financialReconciliationService = require("./financial-reconciliation.service");

  const [
    vendor,
    walletDoc,
    bankAccounts,
    recentEntries,
    settlements,
    payouts,
    withdrawals,
    reconciliation,
  ] = await Promise.all([
    Vendor.findById(vendorId).select("-__v"),
    VendorWallet.findOne({ vendorId, currency: normCurrency }),
    VendorBankAccount.find({ vendorId, deletedAt: null })
      .select("bankName accountHolderName accountNumberMasked ifscCode accountType status isActive isDefault isPrimary")
      .lean(),
    financialLedgerRepository.findVendorEntries(vendorId, { limit: 20 }),
    VendorSettlement.find({ vendorId, currency: normCurrency })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    VendorPayout.find({ vendorId, currency: normCurrency })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    WithdrawalRequest.find({ vendorId, currency: normCurrency })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    financialReconciliationService.reconcileVendorFinances(vendorId, normCurrency),
  ]);

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  let wallet = walletDoc;
  if (!wallet) {
    wallet = await financialLedgerService.syncVendorWalletBalances(vendorId, normCurrency);
  }

  const mappedRecentEntries = recentEntries.map((e) => ({
    _id: e._id,
    id: e._id,
    journalId: e.journalId,
    entryType: e.entryType,
    direction: e.direction,
    accountCode: e.accountCode,
    amount: e.amount?.toString() || "0.00",
    currency: e.currency,
    description: e.description,
    orderId: e.orderId,
    settlementId: e.settlementId,
    payoutId: e.payoutId,
    createdAt: e.createdAt,
    postedAt: e.postedAt || e.createdAt,
  }));

  const mappedSettlements = settlements.map((s) => ({
    _id: s._id,
    id: s._id,
    settlementNumber: s.settlementNumber,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    grossSales: s.grossSales?.toString() || "0.00",
    totalCommission: s.totalCommission?.toString() || "0.00",
    netPayable: s.netPayable?.toString() || "0.00",
    netPayableAmount: s.netPayableAmount || s.netPayable?.toString() || "0.00",
    status: s.status,
    createdAt: s.createdAt,
  }));

  const mappedPayouts = payouts.map((p) => ({
    _id: p._id,
    id: p._id,
    payoutNumber: p.payoutNumber,
    amount: p.amount?.toString() || "0.00",
    provider: p.provider,
    providerReference: p.providerReference,
    status: p.status,
    createdAt: p.createdAt,
  }));

  const mappedWithdrawals = withdrawals.map((w) => ({
    _id: w._id,
    id: w._id,
    withdrawalNumber: w.withdrawalNumber,
    amount: w.amount?.toString() || "0.00",
    status: w.status,
    bankSnapshot: {
      bankName: w.bankSnapshot?.bankName,
      accountNumberMasked: w.bankSnapshot?.accountNumberMasked,
      ifscCode: w.bankSnapshot?.ifscCode,
    },
    reservationJournalId: w.reservationJournalId,
    disbursementJournalId: w.disbursementJournalId,
    releaseJournalId: w.releaseJournalId,
    createdAt: w.createdAt,
  }));

  return {
    vendor: {
      id: vendor._id,
      _id: vendor._id,
      businessName: vendor.businessName,
      storeName: vendor.storeName,
      email: vendor.email,
      phone: vendor.phone,
      businessSlug: vendor.businessSlug,
      isActive: vendor.isActive,
      onboardingStatus: vendor.onboardingStatus,
      commissionRate: vendor.commissionRate,
    },
    wallet: {
      walletId: wallet._id,
      _id: wallet._id,
      id: wallet._id,
      currency: wallet.currency,
      status: wallet.status,
      availableBalance: wallet.availableBalance?.toString() || "0.00",
      reservedBalance: wallet.reservedBalance?.toString() || "0.00",
      pendingBalance: wallet.pendingBalance?.toString() || "0.00",
      totalEarned: wallet.totalEarned?.toString() || "0.00",
      totalCommission: wallet.totalCommission?.toString() || "0.00",
      totalPaidOut: wallet.totalPaidOut?.toString() || "0.00",
      totalRefunded: wallet.totalRefunded?.toString() || "0.00",
      lastReconciledAt: wallet.lastReconciledAt,
      lastReconciliationStatus: wallet.lastReconciliationStatus,
    },
    bankAccounts,
    recentEntries: mappedRecentEntries,
    ledgerEntries: mappedRecentEntries,
    settlements: mappedSettlements,
    payouts: mappedPayouts,
    withdrawals: mappedWithdrawals,
    withdrawalRequests: mappedWithdrawals,
    reconciliation,
  };
};

const getVendorClearanceTimeline = async (vendorId) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  const Order = require("../models/Order");
  const ReturnRequest = require("../models/ReturnRequest");
  const Vendor = require("../models/Vendor");
  const storefrontSettingsService = require("./storefront-settings.service");
  const { WALLET_STATUSES } = require("../constants/finance.constants");

  const [vendor, wallet, activeSettings] = await Promise.all([
    Vendor.findById(vendorId).lean(),
    VendorWallet.findOne({ vendorId, currency: "INR" }).lean(),
    storefrontSettingsService.getActiveSettings().catch(() => null),
  ]);

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  const globalReturnWindowDays = (
    activeSettings?.policies?.returnWindowDays &&
    Number.isInteger(activeSettings.policies.returnWindowDays) &&
    activeSettings.policies.returnWindowDays >= 1 &&
    activeSettings.policies.returnWindowDays <= 90
  ) ? activeSettings.policies.returnWindowDays : 7;

  // Find all non-cancelled orders containing this vendor's items that are pending settlement
  const orders = await Order.find({
    "items.vendorId": vendor._id,
    paymentStatus: { $in: ["paid", "partially_refunded"] },
    status: { $nin: ["cancelled"] },
  })
    .sort({ createdAt: -1 })
    .lean();

  const candidateOrderIds = orders.map((o) => o._id);
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

  const timelineItems = [];
  const now = new Date();

  for (const order of orders) {
    for (const item of (order.items || [])) {
      if (
        item.vendorId &&
        item.vendorId.toString() === vendor._id.toString() &&
        !item.settlementId &&
        item.fulfillmentStatus !== "cancelled"
      ) {
        // Calculate net vendor earning from snapshot or lineTotal - commission
        let netEarningNum = 0;
        if (item.commissionSnapshot?.vendorNetEntitlement) {
          netEarningNum = Number(item.commissionSnapshot.vendorNetEntitlement.toString());
        } else {
          const lineTotal = Number(
            item.lineTotal?.toString() ||
              (item.quantity * Number(item.unitPrice?.toString() || 0))
          );
          const comm = Number(item.commissionAmount?.toString() || 0);
          netEarningNum = Math.max(0, lineTotal - comm);
        }

        const isDelivered = Boolean(
          order.deliveredAt && ["delivered", "completed"].includes(order.status)
        );

        const applicableDays = (
          order.returnWindowDaysSnapshot &&
          Number.isInteger(order.returnWindowDaysSnapshot) &&
          order.returnWindowDaysSnapshot >= 1
        ) ? order.returnWindowDaysSnapshot : Math.max(7, globalReturnWindowDays);

        const deliveryDate = isDelivered ? new Date(order.deliveredAt) : null;
        const returnWindowExpiresAt = deliveryDate
          ? new Date(deliveryDate.getTime() + applicableDays * 24 * 60 * 60 * 1000)
          : null;

        // Check if item has active return
        const isItemOnReturnHold = activeReturns.some(
          (ret) => ret.orderId.toString() === order._id.toString() &&
            (ret.items || []).some(
              (ri) => ri.productId?.toString() === item.productId?.toString() &&
                (!ri.productVariantId || ri.productVariantId?.toString() === item.productVariantId?.toString())
            )
        );

        let status = "awaiting_delivery";
        let statusLabel = "Awaiting Delivery";
        let holdReason = null;

        if (!isDelivered) {
          status = "awaiting_delivery";
          statusLabel = "Awaiting Delivery";
        } else if (isItemOnReturnHold) {
          status = "on_hold";
          statusLabel = "Return / Refund Hold";
          holdReason = "Buyer return request under review";
        } else if (
          wallet &&
          [WALLET_STATUSES.FROZEN, WALLET_STATUSES.SUSPENDED, WALLET_STATUSES.CLOSED].includes(wallet.status)
        ) {
          status = "account_hold";
          statusLabel = "Account Hold";
          holdReason = "Account under administrative compliance review";
        } else if (now < returnWindowExpiresAt) {
          status = "return_window_active";
          statusLabel = "In Return Escrow";
        } else {
          status = "matured";
          statusLabel = "Matured & Ready for Clearance";
        }

        timelineItems.push({
          itemId: String(item._id),
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          productName: item.productName,
          variantName: item.variantName || null,
          sku: item.sku,
          quantity: item.quantity,
          netEarnings: netEarningNum.toFixed(2),
          currency: order.currency || "INR",
          orderStatus: order.status,
          fulfillmentStatus: item.fulfillmentStatus,
          isDelivered,
          deliveredAt: deliveryDate ? deliveryDate.toISOString() : null,
          returnWindowDays: applicableDays,
          returnWindowExpiresAt: returnWindowExpiresAt ? returnWindowExpiresAt.toISOString() : null,
          expectedMaturityAt: returnWindowExpiresAt ? returnWindowExpiresAt.toISOString() : null,
          expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString() : null,
          status,
          statusLabel,
          holdReason,
          placedAt: order.placedAt || order.createdAt,
        });
      }
    }
  }

  // Sort: matured first, then by returnWindowExpiresAt ascending, then by placedAt descending
  timelineItems.sort((a, b) => {
    if (a.status === "matured" && b.status !== "matured") return -1;
    if (b.status === "matured" && a.status !== "matured") return 1;
    if (a.returnWindowExpiresAt && b.returnWindowExpiresAt) {
      return new Date(a.returnWindowExpiresAt) - new Date(b.returnWindowExpiresAt);
    }
    return new Date(b.placedAt) - new Date(a.placedAt);
  });

  const totalPendingAmount = timelineItems.reduce(
    (sum, item) => sum + Number(item.netEarnings),
    0
  );

  return {
    vendorId,
    currency: "INR",
    summary: {
      pendingBalance: wallet?.pendingBalance?.toString() || "0.00",
      availableBalance: wallet?.availableBalance?.toString() || "0.00",
      reservedBalance: wallet?.reservedBalance?.toString() || "0.00",
      totalPendingItems: timelineItems.length,
      totalPendingAmount: totalPendingAmount.toFixed(2),
      awaitingDeliveryCount: timelineItems.filter((i) => i.status === "awaiting_delivery").length,
      returnWindowActiveCount: timelineItems.filter((i) => i.status === "return_window_active").length,
      maturedCount: timelineItems.filter((i) => i.status === "matured").length,
      onHoldCount: timelineItems.filter((i) => i.status === "on_hold" || i.status === "account_hold").length,
    },
    items: timelineItems,
  };
};

module.exports = {
  getVendorWallet,
  getVendorTransactions,
  getVendorClearanceTimeline,
  formatWalletResponse,
  listAdminVendorWallets,
  getAdminVendorDrilldown,
};

