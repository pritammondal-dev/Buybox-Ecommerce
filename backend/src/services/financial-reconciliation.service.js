const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");
const VendorWallet = require("../models/VendorWallet");
const { VendorSettlement } = require("../models/VendorSettlement");
const VendorPayout = require("../models/VendorPayout");
const Refund = require("../models/Refund");
const AuditLog = require("../models/AuditLog");
const financialLedgerService = require("./financial-ledger.service");
const AppError = require("../errors/AppError");

const reconcileVendorFinances = async (
  vendorId,
  currency = "INR",
  { syncCachedWallet = false, actorId = null, reason = null } = {}
) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  const normalizedCurrency = String(currency || "INR").trim().toUpperCase();

  // 1. Authoritative double-entry ledger calculation
  const ledgerBalances = await financialLedgerService.getVendorBalancesFromLedger(
    vendorId,
    normalizedCurrency
  );

  // 2. Cached VendorWallet projection
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

  const walletBalances = {
    pendingBalance: wallet.pendingBalance?.toString() || "0.00",
    availableBalance: wallet.availableBalance?.toString() || "0.00",
    reservedBalance: wallet.reservedBalance?.toString() || "0.00",
    totalEarned: wallet.totalEarned?.toString() || "0.00",
    totalCommission: wallet.totalCommission?.toString() || "0.00",
    totalPaidOut: wallet.totalPaidOut?.toString() || "0.00",
    totalRefunded: wallet.totalRefunded?.toString() || "0.00",
  };

  // 3. VendorSettlement totals
  const settlements = await VendorSettlement.find({
    vendorId,
    currency: normalizedCurrency,
  }).lean();

  let settledPaidMinor = 0;
  let settledPayableMinor = 0;
  let settledPendingMinor = 0;

  for (const s of settlements) {
    const sMinor = Math.round(Number(s.netPayable?.toString() || 0) * 100);
    if (s.status === "paid") {
      settledPaidMinor += sMinor;
    } else if (s.status === "payable") {
      settledPayableMinor += sMinor;
    } else if (["pending", "eligible", "processing"].includes(s.status)) {
      settledPendingMinor += sMinor;
    }
  }

  // 4. VendorPayout totals
  const payouts = await VendorPayout.find({
    vendorId,
    currency: normalizedCurrency,
  }).lean();

  let payoutPaidMinor = 0;
  let payoutPendingMinor = 0;
  let payoutProcessingMinor = 0;
  let payoutFailedMinor = 0;

  for (const p of payouts) {
    const pMinor = Math.round(Number(p.amount?.toString() || 0) * 100);
    if (p.status === "paid") {
      payoutPaidMinor += pMinor;
    } else if (p.status === "pending") {
      payoutPendingMinor += pMinor;
    } else if (p.status === "processing") {
      payoutProcessingMinor += pMinor;
    } else if (p.status === "failed") {
      payoutFailedMinor += pMinor;
    }
  }

  // 4b. WithdrawalRequest totals
  const WithdrawalRequest = require("../models/WithdrawalRequest");
  const withdrawals = await WithdrawalRequest.find({
    vendorId,
    currency: normalizedCurrency,
  }).lean();

  let withdrawalPendingMinor = 0;
  let withdrawalCompletedMinor = 0;

  for (const w of withdrawals) {
    const wMinor = Math.round(Number(w.amount?.toString() || 0) * 100);
    if (["pending_review", "approved", "processing"].includes(w.status)) {
      withdrawalPendingMinor += wMinor;
    } else if (w.status === "completed") {
      withdrawalCompletedMinor += wMinor;
    }
  }

  // 5. Compare and check for discrepancies
  const discrepancies = [];

  const compareField = (name, ledgerVal, walletVal) => {
    const diff = Math.abs(Number(ledgerVal) - Number(walletVal));
    if (diff > 0.005) {
      discrepancies.push({
        field: name,
        ledgerValue: ledgerVal,
        walletValue: walletVal,
        difference: diff.toFixed(2),
        type: "WALLET_PROJECTION_MISMATCH",
      });
    }
  };

  compareField("pendingBalance", ledgerBalances.pendingBalance, walletBalances.pendingBalance);
  compareField("availableBalance", ledgerBalances.availableBalance, walletBalances.availableBalance);
  compareField("reservedBalance", ledgerBalances.reservedBalance, walletBalances.reservedBalance);
  compareField("totalEarned", ledgerBalances.totalEarned, walletBalances.totalEarned);
  compareField("totalCommission", ledgerBalances.totalCommission, walletBalances.totalCommission);
  compareField("totalPaidOut", ledgerBalances.totalPaidOut, walletBalances.totalPaidOut);
  compareField("totalRefunded", ledgerBalances.totalRefunded, walletBalances.totalRefunded);

  // Check payout total vs ledger paid out
  const ledgerPaidOutNum = Number(ledgerBalances.totalPaidOut);
  const payoutPaidNum = payoutPaidMinor / 100;
  if (Math.abs(ledgerPaidOutNum - payoutPaidNum) > 0.005) {
    discrepancies.push({
      field: "paidOutReconciliation",
      ledgerPaidOut: ledgerBalances.totalPaidOut,
      actualPayoutPaid: payoutPaidNum.toFixed(2),
      difference: Math.abs(ledgerPaidOutNum - payoutPaidNum).toFixed(2),
      type: "PAYOUT_LEDGER_MISMATCH",
    });
  }

  const isReconciled = discrepancies.length === 0;

  // 6. If explicit sync is requested by authorized caller with mandatory reason
  if (syncCachedWallet && !isReconciled) {
    if (!reason || !String(reason).trim()) {
      throw new AppError(
        "A mandatory reason is required to synchronize wallet balance projections",
        400,
        "REASON_REQUIRED"
      );
    }

    const beforeState = { ...walletBalances };
    wallet = await financialLedgerService.syncVendorWalletBalances(
      vendorId,
      normalizedCurrency
    );

    await AuditLog.create({
      actorId: actorId || vendorId,
      targetId: wallet._id,
      action: "WALLET_RECONCILIATION_SYNCED",
      entityType: "vendor_wallet",
      beforeState,
      afterState: {
        pendingBalance: wallet.pendingBalance?.toString(),
        availableBalance: wallet.availableBalance?.toString(),
        reservedBalance: wallet.reservedBalance?.toString(),
        totalEarned: wallet.totalEarned?.toString(),
        totalPaidOut: wallet.totalPaidOut?.toString(),
      },
      reason: String(reason).trim(),
    }).catch(() => {});
  }

  return {
    vendorId: String(vendorId),
    currency: normalizedCurrency,
    isReconciled,
    discrepancies,
    discrepancyCount: discrepancies.length,
    ledgerBalances: {
      pendingBalance: ledgerBalances.pendingBalance,
      availableBalance: ledgerBalances.availableBalance,
      reservedBalance: ledgerBalances.reservedBalance,
      totalEarned: ledgerBalances.totalEarned,
      totalCommission: ledgerBalances.totalCommission,
      totalPaidOut: ledgerBalances.totalPaidOut,
      totalRefunded: ledgerBalances.totalRefunded,
    },
    walletBalances,
    settlementSummary: {
      settlementCount: settlements.length,
      paidTotal: (settledPaidMinor / 100).toFixed(2),
      payableTotal: (settledPayableMinor / 100).toFixed(2),
      pendingTotal: (settledPendingMinor / 100).toFixed(2),
    },
    payoutSummary: {
      payoutCount: payouts.length,
      paidTotal: (payoutPaidMinor / 100).toFixed(2),
      pendingTotal: (payoutPendingMinor / 100).toFixed(2),
      processingTotal: (payoutProcessingMinor / 100).toFixed(2),
      failedTotal: (payoutFailedMinor / 100).toFixed(2),
    },
    withdrawalSummary: {
      withdrawalCount: withdrawals.length,
      pendingTotal: (withdrawalPendingMinor / 100).toFixed(2),
      completedTotal: (withdrawalCompletedMinor / 100).toFixed(2),
    },
    reconciledAt: new Date(),
  };
};

/**
 * Executes a balanced, immutable financial correction journal.
 * Requires FINANCE_MANAGE and records before/after reconciliation diagnostics.
 */
const postFinancialCorrection = async ({
  vendorId,
  amount,
  direction, // 'debit' | 'credit'
  accountCode,
  contraAccountCode,
  reason,
  actorId,
  currency = "INR",
  idempotencyKey = null,
}) => {
  const normCurrency = String(currency || "INR").trim().toUpperCase();

  // 1. Capture before-state
  const beforeState = await reconcileVendorFinances(vendorId, normCurrency);

  // 2. Post balanced double-entry correction journal
  const journalResult = await financialLedgerService.postReconciliationAdjustmentJournal({
    vendorId,
    amount,
    direction,
    accountCode,
    contraAccountCode,
    reason,
    actorId,
    currency: normCurrency,
    idempotencyKey,
  });

  // 3. Capture after-state
  const afterState = await reconcileVendorFinances(vendorId, normCurrency);

  const entriesList = Array.isArray(journalResult) ? journalResult : [journalResult];
  const actualJournalId = entriesList[0]?.journalId || journalResult?.journalId;

  // 4. Create immutable AuditLog
  await AuditLog.create({
    actorId,
    targetId: vendorId,
    action: "FINANCIAL_CORRECTION_JOURNAL_POSTED",
    entityType: "financial_ledger",
    beforeState: beforeState.walletBalances,
    afterState: afterState.walletBalances,
    reason: String(reason).trim(),
    metadata: {
      journalId: actualJournalId,
      amount,
      direction,
      discrepancyCountBefore: beforeState.discrepancyCount,
      discrepancyCountAfter: afterState.discrepancyCount,
    },
  }).catch(() => {});

  return {
    journal: {
      journalId: actualJournalId,
      entries: entriesList,
    },
    beforeState,
    afterState,
    isReconciled: afterState.isReconciled,
  };
};

/**
 * System-wide reconciliation health and discrepancy summary
 */
const getPlatformReconciliationSummary = async (currency = "INR") => {
  const normCurrency = String(currency || "INR").trim().toUpperCase();

  const wallets = await VendorWallet.find({ currency: normCurrency })
    .populate("vendorId", "businessName storeName email phone businessSlug")
    .lean();

  let reconciledCount = 0;
  let discrepancyCount = 0;
  const discrepantWallets = [];

  for (const w of wallets) {
    if (!w.vendorId) continue;
    const vendorId = w.vendorId._id || w.vendorId;
    const report = await reconcileVendorFinances(vendorId, normCurrency);

    if (report.isReconciled) {
      reconciledCount++;
    } else {
      discrepancyCount++;
      discrepantWallets.push({
        vendorId,
        businessName: w.vendorId?.businessName || "Unknown Vendor",
        email: w.vendorId?.email,
        walletBalances: report.walletBalances,
        ledgerBalances: report.ledgerBalances,
        discrepancies: report.discrepancies,
        discrepancyCount: report.discrepancyCount,
      });
    }
  }

  return {
    currency: normCurrency,
    totalWallets: wallets.length,
    reconciledCount,
    discrepancyCount,
    isClean: discrepancyCount === 0,
    discrepantWallets,
    generatedAt: new Date(),
  };
};

module.exports = {
  reconcileVendorFinances,
  postFinancialCorrection,
  getPlatformReconciliationSummary,
};

