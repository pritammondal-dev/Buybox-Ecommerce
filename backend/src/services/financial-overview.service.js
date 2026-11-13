const mongoose = require("mongoose");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Vendor = require("../models/Vendor");
const VendorWallet = require("../models/VendorWallet");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const VendorPayout = require("../models/VendorPayout");
const Refund = require("../models/Refund");
const FinancialLedgerEntry = require("../models/FinancialLedgerEntry");
const financialReconciliationService = require("./financial-reconciliation.service");
const financialExceptionService = require("./financial-exception.service");
const AppError = require("../errors/AppError");
const {
  LEDGER_ACCOUNTS,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ENTRY_TYPES,
  WITHDRAWAL_STATUSES,
  JOURNAL_STATUSES,
  EXCEPTION_CATEGORIES,
} = require("../constants/finance.constants");

/**
 * Builds a strict, exclusive calendar date boundary filter.
 * Ensures that full day ranges (e.g. YYYY-MM-DD or 00:00:00.000Z) include the entire end date
 * by executing $gte: start and $lt: nextDayStart.
 */
const buildDateRangeFilter = (startDate, endDate, dateField = "createdAt") => {
  if (!startDate && !endDate) return {};

  let start = null;
  let end = null;

  if (startDate) {
    start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new AppError("Invalid startDate format. Expected ISO-8601 or YYYY-MM-DD.", 400, "INVALID_DATE_RANGE");
    }
  }

  if (endDate) {
    // If endDate is date-only string (e.g. '2026-11-02'), treat as inclusive of that full day
    if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      const parts = endDate.trim().split("-").map(Number);
      end = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1, 0, 0, 0, 0));
    } else {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new AppError("Invalid endDate format. Expected ISO-8601 or YYYY-MM-DD.", 400, "INVALID_DATE_RANGE");
      }
      // If client sent ISO string ending at 00:00:00.000Z representing a calendar date selection,
      // expand to next day start to make the day inclusive
      if (typeof endDate === "string" && endDate.endsWith("T00:00:00.000Z")) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
    }
  }

  if (start && end && start > end) {
    throw new AppError("startDate cannot be greater than endDate.", 400, "INVALID_DATE_RANGE");
  }

  const dateFilter = {};
  if (start || end) {
    dateFilter[dateField] = {};
    if (start) dateFilter[dateField].$gte = start;
    if (end) dateFilter[dateField].$lt = end;
  }

  return dateFilter;
};

/**
 * Superadmin Financial Overview Service
 *
 * Produces server-authoritative marketplace financial health aggregations:
 * - Gross order sales vs captured customer payments
 * - Platform commission earned vs reversals
 * - Total vendor liabilities (available, reserved escrow, pending clearing)
 * - Actual cash outflows (disbursed payouts and customer refunds)
 * - Operational queues (pending, processing, ambiguous, failed withdrawals)
 * - Authoritative platform reconciliation health
 */
const getFinancialOverview = async ({
  startDate = null,
  endDate = null,
  currency = "INR",
  actorId = null,
} = {}) => {
  const normCurrency = String(currency || "INR").trim().toUpperCase();

  // 1. Build date range filters for time-bounded queries
  const orderDateFilter = buildDateRangeFilter(startDate, endDate, "createdAt");
  const paymentDateFilter = buildDateRangeFilter(startDate, endDate, "createdAt");
  const ledgerDateFilter = buildDateRangeFilter(startDate, endDate, "createdAt");
  const refundDateFilter = buildDateRangeFilter(startDate, endDate, "createdAt");
  const payoutDateFilter = buildDateRangeFilter(startDate, endDate, "createdAt");
  const withdrawalDateFilter = buildDateRangeFilter(startDate, endDate, "createdAt");

  // 2. Gross Commercial Order Sales (Orders placed excluding cancelled)
  const orderMatch = {
    currency: normCurrency,
    status: { $nin: ["cancelled"] },
    ...orderDateFilter,
  };

  const orderStats = await Order.aggregate([
    { $match: orderMatch },
    {
      $group: {
        _id: null,
        totalGross: {
          $sum: {
            $cond: [
              { $gt: [{ $toDouble: { $ifNull: ["$grandTotal", 0] } }, 0] },
              { $toDouble: "$grandTotal" },
              0,
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const grossOrderValue = orderStats[0]?.totalGross || 0;
  const orderCount = orderStats[0]?.count || 0;

  // 3. Captured Customer Payments (Gateway successful captures)
  const paymentMatch = {
    currency: normCurrency,
    status: { $in: ["captured", "partially_refunded", "refunded"] },
    ...paymentDateFilter,
  };

  const paymentStats = await Payment.aggregate([
    { $match: paymentMatch },
    {
      $group: {
        _id: null,
        totalCaptured: {
          $sum: {
            $cond: [
              { $gt: [{ $toDouble: { $ifNull: ["$amount", 0] } }, 0] },
              { $toDouble: "$amount" },
              0,
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const capturedPaymentValue = paymentStats[0]?.totalCaptured || 0;
  const capturedPaymentCount = paymentStats[0]?.count || 0;

  // 4. Vendor Liabilities from VendorWallets (Point-in-time balance sheet liabilities)
  const walletStats = await VendorWallet.aggregate([
    { $match: { currency: normCurrency } },
    {
      $group: {
        _id: null,
        totalAvailable: { $sum: { $toDouble: { $ifNull: ["$availableBalance", 0] } } },
        totalReserved: { $sum: { $toDouble: { $ifNull: ["$reservedBalance", 0] } } },
        totalPending: { $sum: { $toDouble: { $ifNull: ["$pendingBalance", 0] } } },
        totalEarned: { $sum: { $toDouble: { $ifNull: ["$totalEarned", 0] } } },
        totalCommission: { $sum: { $toDouble: { $ifNull: ["$totalCommission", 0] } } },
        totalPaidOut: { $sum: { $toDouble: { $ifNull: ["$totalPaidOut", 0] } } },
        totalRefunded: { $sum: { $toDouble: { $ifNull: ["$totalRefunded", 0] } } },
        walletCount: { $sum: 1 },
      },
    },
  ]);

  const availableEarnings = walletStats[0]?.totalAvailable || 0;
  const reservedPayouts = walletStats[0]?.totalReserved || 0;
  const pendingEarnings = walletStats[0]?.totalPending || 0;
  const totalGrossEarned = walletStats[0]?.totalEarned || 0;
  const totalCommissionEarned = walletStats[0]?.totalCommission || 0;
  const totalPaidOutFromWallets = walletStats[0]?.totalPaidOut || 0;
  const totalRefundedFromWallets = walletStats[0]?.totalRefunded || 0;
  const totalWallets = walletStats[0]?.walletCount || 0;
  const totalLiability = availableEarnings + reservedPayouts + pendingEarnings;

  // 5. Ledger-Level Platform Commission & Reversals
  const ledgerCommissionStats = await FinancialLedgerEntry.aggregate([
    {
      $match: {
        currency: normCurrency,
        entryType: {
          $in: [
            FINANCIAL_ENTRY_TYPES.PLATFORM_COMMISSION,
            FINANCIAL_ENTRY_TYPES.COMMISSION_REVERSAL,
          ],
        },
        ...ledgerDateFilter,
      },
    },
    {
      $group: {
        _id: "$entryType",
        total: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
      },
    },
  ]);

  let grossLedgerCommission = 0;
  let commissionReversals = 0;

  for (const stat of ledgerCommissionStats) {
    if (stat._id === FINANCIAL_ENTRY_TYPES.PLATFORM_COMMISSION) {
      grossLedgerCommission = stat.total;
    } else if (stat._id === FINANCIAL_ENTRY_TYPES.COMMISSION_REVERSAL) {
      commissionReversals = stat.total;
    }
  }

  // If date-filtered, report the ledger commission in that window; otherwise fallback to wallet cumulative commission if ledger is empty
  const isDateFiltered = Boolean(startDate || endDate);
  const reportedGrossCommission = isDateFiltered
    ? grossLedgerCommission
    : (grossLedgerCommission > 0 ? grossLedgerCommission : totalCommissionEarned);
  const netPlatformCommission = Math.max(0, reportedGrossCommission - commissionReversals);

  // 6. Cash Outflows: Disbursed Payouts & Processed Customer Refunds
  // 6a. Disbursed Vendor Payouts
  const payoutMatch = {
    currency: normCurrency,
    status: "paid",
    ...payoutDateFilter,
  };

  const payoutStats = await VendorPayout.aggregate([
    { $match: payoutMatch },
    {
      $group: {
        _id: null,
        totalPaidOut: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalPaidOut = payoutStats[0]?.totalPaidOut ?? (isDateFiltered ? 0 : totalPaidOutFromWallets);

  // 6b. Processed Customer Refunds
  const refundMatch = {
    currency: normCurrency,
    status: "processed",
    ...refundDateFilter,
  };

  const refundStats = await Refund.aggregate([
    { $match: refundMatch },
    {
      $group: {
        _id: null,
        totalRefunded: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalCustomerRefunds = refundStats[0]?.totalRefunded ?? (isDateFiltered ? 0 : totalRefundedFromWallets);
  const netCashOutflow = totalPaidOut + totalCustomerRefunds;

  // 7. Withdrawal Request Queues & Operational Exception Breakdown
  const withdrawalMatch = {
    currency: normCurrency,
    ...withdrawalDateFilter,
  };

  const withdrawalStats = await WithdrawalRequest.aggregate([
    { $match: withdrawalMatch },
    {
      $group: {
        _id: "$status",
        totalAmount: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
        count: { $sum: 1 },
      },
    },
  ]);

  const queueMap = {
    pending_review: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    processing: { count: 0, amount: 0 },
    completed: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 },
    failed: { count: 0, amount: 0 },
  };

  for (const s of withdrawalStats) {
    if (queueMap[s._id]) {
      queueMap[s._id] = { count: s.count, amount: s.totalAmount };
    }
  }

  const outstandingWithdrawalsCount =
    queueMap.pending_review.count + queueMap.approved.count + queueMap.processing.count;
  const outstandingWithdrawalsAmount =
    queueMap.pending_review.amount + queueMap.approved.amount + queueMap.processing.amount;

  // 8. Authoritative Platform Reconciliation Health & General Ledger Balancing
  let reconReport = null;
  let reconError = null;
  try {
    reconReport = await financialReconciliationService.getPlatformReconciliationSummary(normCurrency);
  } catch (err) {
    reconError = err.message;
  }

  // 8a. Ensure known legacy prototype artifacts are safely and idempotently classified
  try {
    await financialExceptionService.ensureKnownLegacyExceptionsClassified(actorId);
  } catch (err) {
    // Non-blocking: proceed with retrieval
  }

  // 8b. Retrieve active legacy exceptions and their excluded IDs
  let legacyExceptions = { count: 0, totalAmount: 0, currency: normCurrency, items: [] };
  try {
    legacyExceptions = await financialExceptionService.getLegacyExceptions({ currency: normCurrency });
  } catch (err) {
    // Non-blocking
  }

  const excludedEntryIds = legacyExceptions.items
    .filter((e) => e.operationalScopeExclusion && e.ledgerEntryId)
    .map((e) => new mongoose.Types.ObjectId(e.ledgerEntryId));

  // 8c. Operational General Ledger Trial Balance (Scope B: Documented, Valid Posted Journals)
  const operationalTrialBalanceMatch = {
    currency: normCurrency,
    journalStatus: JOURNAL_STATUSES.POSTED,
    accountCode: { $ne: null },
    _id: { $nin: excludedEntryIds },
  };

  const operationalEntries = await FinancialLedgerEntry.aggregate([
    { $match: operationalTrialBalanceMatch },
    {
      $group: {
        _id: "$direction",
        total: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
        count: { $sum: 1 },
      },
    },
  ]);

  let operationalDebits = 0;
  let operationalCredits = 0;
  let operationalEntriesCount = 0;
  for (const op of operationalEntries) {
    if (op._id === FINANCIAL_ENTRY_DIRECTIONS.DEBIT) operationalDebits = op.total;
    if (op._id === FINANCIAL_ENTRY_DIRECTIONS.CREDIT) operationalCredits = op.total;
    operationalEntriesCount += op.count;
  }

  const operationalVariance = Math.abs(Math.round((operationalDebits - operationalCredits) * 100) / 100);
  const operationalBalanced = operationalVariance < 0.01;

  const includedJournals = await FinancialLedgerEntry.distinct("journalId", operationalTrialBalanceMatch);
  const includedJournalsCount = includedJournals.length;

  // 8d. Complete Database General Ledger (Scope A: All Records for Full Disclosure)
  const rawTrialBalanceEntries = await FinancialLedgerEntry.aggregate([
    { $match: { currency: normCurrency } },
    {
      $group: {
        _id: "$direction",
        total: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
        count: { $sum: 1 },
      },
    },
  ]);

  let rawTotalDebits = 0;
  let rawTotalCredits = 0;
  let rawEntriesCount = 0;
  for (const tb of rawTrialBalanceEntries) {
    if (tb._id === FINANCIAL_ENTRY_DIRECTIONS.DEBIT) rawTotalDebits = tb.total;
    if (tb._id === FINANCIAL_ENTRY_DIRECTIONS.CREDIT) rawTotalCredits = tb.total;
    rawEntriesCount += tb.count;
  }

  const rawVariance = Math.abs(Math.round((rawTotalDebits - rawTotalCredits) * 100) / 100);
  const rawBalanced = rawVariance < 0.01;

  // 8e. Platform Escrow Clearing Balance (Account 1110)
  const escrowEntries = await FinancialLedgerEntry.aggregate([
    {
      $match: {
        currency: normCurrency,
        accountCode: LEDGER_ACCOUNTS.PLATFORM_ESCROW,
      },
    },
    {
      $group: {
        _id: "$direction",
        total: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
      },
    },
  ]);

  let escrowDebits = 0;
  let escrowCredits = 0;
  for (const e of escrowEntries) {
    if (e._id === FINANCIAL_ENTRY_DIRECTIONS.DEBIT) escrowDebits = e.total;
    if (e._id === FINANCIAL_ENTRY_DIRECTIONS.CREDIT) escrowCredits = e.total;
  }
  const clearingBalance = Math.max(0, Math.round((escrowDebits - escrowCredits) * 100) / 100);

  // 8f. Authoritative 6-State Reconciliation Health Status
  const auditedWalletsCount = reconReport?.totalWallets ?? totalWallets;
  const discrepanciesFound = reconReport?.discrepancyCount ?? 0;
  const isClean = Boolean(reconReport?.isClean && operationalBalanced);

  let reconStatus = "passed";
  let reconStatusLabel = "100% Balanced & Reconciled";

  if (reconError) {
    reconStatus = "failed";
    reconStatusLabel = "Reconciliation Check Failed";
  } else if (discrepanciesFound > 0) {
    reconStatus = "discrepancies_found";
    reconStatusLabel = `${discrepanciesFound} Discrepanc${discrepanciesFound === 1 ? "y" : "ies"} Detected`;
  } else if (!operationalBalanced) {
    reconStatus = "discrepancies_found";
    reconStatusLabel = `Operational GL Variance (${normCurrency} ${operationalVariance.toFixed(2)})`;
  } else if (auditedWalletsCount === 0 && operationalEntriesCount === 0) {
    reconStatus = "empty";
    reconStatusLabel = "No Records Available to Evaluate";
  } else if (auditedWalletsCount === 0) {
    reconStatus = "empty";
    reconStatusLabel = "No Records Available to Evaluate";
  } else if (legacyExceptions.count > 0) {
    reconStatus = "passed_with_legacy_exceptions";
    reconStatusLabel = `Operational Balanced (${legacyExceptions.count} Legacy Exception${legacyExceptions.count === 1 ? "" : "s"} Disclosed)`;
  } else {
    reconStatus = "passed";
    reconStatusLabel = "100% Balanced & Reconciled";
  }

  // 9. Construct Dual-Contract Harmonized Response DTO
  const salesAndRevenue = {
    grossOrderValue: Number(grossOrderValue.toFixed(2)),
    orderCount,
    capturedPaymentValue: Number(capturedPaymentValue.toFixed(2)),
    capturedPaymentCount,
  };

  const platformCommission = {
    grossCommission: Number(reportedGrossCommission.toFixed(2)),
    grossCommissionEarned: Number(reportedGrossCommission.toFixed(2)),
    commissionReversals: Number(commissionReversals.toFixed(2)),
    netCommission: Number(netPlatformCommission.toFixed(2)),
  };

  const vendorLiabilities = {
    pendingEarnings: Number(pendingEarnings.toFixed(2)),
    availableEarnings: Number(availableEarnings.toFixed(2)),
    reservedPayouts: Number(reservedPayouts.toFixed(2)),
    totalLiability: Number(totalLiability.toFixed(2)),
    totalGrossEarned: Number(totalGrossEarned.toFixed(2)),
  };

  const cashDisbursements = {
    totalPaidOut: Number(totalPaidOut.toFixed(2)),
    totalRefunded: Number(totalCustomerRefunds.toFixed(2)),
    netCashOutflow: Number(netCashOutflow.toFixed(2)),
  };

  const operationalQueues = {
    outstandingWithdrawalsCount,
    outstandingWithdrawalsAmount: Number(outstandingWithdrawalsAmount.toFixed(2)),
    pendingReviewCount: queueMap.pending_review.count,
    pendingReviewAmount: Number(queueMap.pending_review.amount.toFixed(2)),
    approvedCount: queueMap.approved.count,
    approvedAmount: Number(queueMap.approved.amount.toFixed(2)),
    processingCount: queueMap.processing.count,
    processingAmount: Number(queueMap.processing.amount.toFixed(2)),
    completedCount: queueMap.completed.count,
    completedAmount: Number(queueMap.completed.amount.toFixed(2)),
    rejectedCount: queueMap.rejected.count,
    rejectedAmount: Number(queueMap.rejected.amount.toFixed(2)),
    failedCount: queueMap.failed.count,
    failedAmount: Number(queueMap.failed.amount.toFixed(2)),
    ambiguousCount: 0,
    ambiguousAmount: 0,
    // Aliases for frontend compatibility
    withdrawalsPendingReview: queueMap.pending_review.count,
    withdrawalsProcessing: queueMap.processing.count,
    withdrawalsFailed: queueMap.failed.count,
    ambiguousTransfers: 0,
  };

  const operationalTrialBalance = {
    scope: "operational_posted_journals",
    totalDebits: Number(operationalDebits.toFixed(2)),
    totalCredits: Number(operationalCredits.toFixed(2)),
    unallocatedVariance: Number(operationalVariance.toFixed(2)),
    isBalanced: operationalBalanced,
    includedJournalsCount,
    includedEntriesCount: operationalEntriesCount,
    excludedExceptionEntriesCount: legacyExceptions.count,
    clearingBalance,
  };

  const rawTrialBalance = {
    scope: "all_database_ledger_entries",
    totalDebits: Number(rawTotalDebits.toFixed(2)),
    totalCredits: Number(rawTotalCredits.toFixed(2)),
    unallocatedVariance: Number(rawVariance.toFixed(2)),
    isBalanced: rawBalanced,
    totalEntriesCount: rawEntriesCount,
  };

  const reconciliationHealth = {
    status: reconStatus,
    statusLabel: reconStatusLabel,
    totalWallets: auditedWalletsCount,
    totalWalletsAudited: auditedWalletsCount,
    reconciledWallets: reconReport?.reconciledCount ?? auditedWalletsCount,
    discrepancyWallets: discrepanciesFound,
    discrepantWalletsCount: discrepanciesFound,
    discrepanciesCount: discrepanciesFound,
    isClean,
    discrepancyRate: auditedWalletsCount > 0 ? Number(((discrepanciesFound / auditedWalletsCount) * 100).toFixed(2)) : 0,
    trialBalanceBalanced: operationalBalanced,
    unallocatedVariance: operationalVariance,
    rawUnallocatedVariance: rawVariance,
    operationalBalanced,
    operationalVariance,
    clearingBalance,
    operationalTrialBalance,
    rawTrialBalance,
    legacyExceptionsCount: legacyExceptions.count,
    legacyExceptionsTotalAmount: legacyExceptions.totalAmount,
    auditedAt: reconReport?.generatedAt || new Date(),
    hasError: Boolean(reconError),
    errorMessage: reconError || null,
  };

  // Harmonized flat metrics for backwards compatibility and instant dashboard binding
  const metrics = {
    grossOrderValue: salesAndRevenue.grossOrderValue,
    orderCount: salesAndRevenue.orderCount,
    capturedPaymentValue: salesAndRevenue.capturedPaymentValue,
    capturedPaymentCount: salesAndRevenue.capturedPaymentCount,
    platformCommissionEarned: platformCommission.grossCommission,
    commissionReversals: platformCommission.commissionReversals,
    netPlatformCommission: platformCommission.netCommission,
    vendorTotalLiabilities: vendorLiabilities.totalLiability,
    vendorAvailableBalance: vendorLiabilities.availableEarnings,
    vendorReservedBalance: vendorLiabilities.reservedPayouts,
    vendorPendingBalance: vendorLiabilities.pendingEarnings,
    vendorLifetimeEarned: vendorLiabilities.totalGrossEarned,
    totalCashOutflows: cashDisbursements.netCashOutflow,
    totalDisbursements: cashDisbursements.totalPaidOut,
    totalCustomerRefunds: cashDisbursements.totalRefunded,
    operationalDebits: operationalTrialBalance.totalDebits,
    operationalCredits: operationalTrialBalance.totalCredits,
    operationalVariance: operationalTrialBalance.unallocatedVariance,
    legacyExceptionsCount: legacyExceptions.count,
    legacyExceptionsTotalAmount: legacyExceptions.totalAmount,
  };

  return {
    currency: normCurrency,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    metrics,
    salesAndRevenue,
    platformCommission,
    vendorLiabilities,
    cashDisbursements,
    operationalQueues,
    operationalTrialBalance,
    rawTrialBalance,
    legacyExceptions,
    reconciliationHealth,
    generatedAt: new Date(),
  };
};

module.exports = {
  getFinancialOverview,
};
