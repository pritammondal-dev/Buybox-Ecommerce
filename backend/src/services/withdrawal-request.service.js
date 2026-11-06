const mongoose = require("mongoose");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const VendorPayout = require("../models/VendorPayout");
const { VENDOR_PAYOUT_STATUSES } = require("../models/VendorPayout");
const VendorWallet = require("../models/VendorWallet");
const Vendor = require("../models/Vendor");
const VendorBankAccount = require("../models/VendorBankAccount");
const AuditLog = require("../models/AuditLog");
const AppError = require("../errors/AppError");
const logger = require("../config/logger");

const withdrawalRequestRepository = require("../repositories/withdrawal-request.repository");
const financialLedgerService = require("./financial-ledger.service");
const vendorPayoutService = require("./vendor-payout.service");
const payoutSandboxAdapter = require("../integrations/payments/payout-sandbox.adapter");
const notificationService = require("./notification");

const {
  WITHDRAWAL_STATUSES,
  FINANCIAL_ENTRY_TYPES,
} = require("../constants/finance.constants");
const { PAYMENT_GATEWAYS } = require("../constants/payment.constants");

const generateWithdrawalNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WTH-${dateStr}-${random}`;
};

/**
 * Creates and atomically reserves a new vendor withdrawal request
 */
const requestWithdrawal = async ({
  vendorId,
  amount,
  bankAccountId,
  notes = null,
  idempotencyKey = null,
  actorId = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  if (!mongoose.isValidObjectId(bankAccountId)) {
    throw new AppError("Invalid bank account ID", 400, "INVALID_BANK_ACCOUNT_ID");
  }

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new AppError("Withdrawal amount must be a positive number", 400, "INVALID_WITHDRAWAL_AMOUNT");
  }

  if (!idempotencyKey || !String(idempotencyKey).trim()) {
    throw new AppError("Idempotency key is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
  }

  const normalizedIdempotencyKey = String(idempotencyKey).trim();

  // 1. Idempotency Check
  const existing = await withdrawalRequestRepository.findByIdempotencyKey(
    vendorId,
    normalizedIdempotencyKey
  );

  if (existing) {
    existing._isExisting = true;
    return existing;
  }

  // 2. Validate Vendor Status (pre-transaction validation)
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  if (
    !vendor.isActive ||
    (vendor.onboardingStatus && vendor.onboardingStatus !== "approved") ||
    vendor.onboardingStatus === "suspended" ||
    vendor.onboardingStatus === "rejected"
  ) {
    throw new AppError("Vendor is not eligible for withdrawals", 403, "VENDOR_NOT_ELIGIBLE_FOR_WITHDRAWALS");
  }

  // 3. Validate Selected Bank Account (pre-transaction validation)
  const bank = await VendorBankAccount.findById(bankAccountId);
  if (!bank || String(bank.vendorId) !== String(vendorId)) {
    throw new AppError("Selected bank account does not belong to this vendor", 400, "BANK_ACCOUNT_MISMATCH");
  }

  if (bank.deletedAt) {
    throw new AppError("Selected bank account is archived", 400, "BANK_ACCOUNT_ARCHIVED");
  }

  if (bank.status !== "approved") {
    throw new AppError("Selected bank account is not approved for payouts", 400, "BANK_ACCOUNT_NOT_APPROVED");
  }

  if (
    !bank.accountHolderName ||
    !bank.bankName ||
    !bank.ifscCode ||
    !bank.accountNumberMasked
  ) {
    throw new AppError("Bank account destination data is incomplete", 400, "INCOMPLETE_DESTINATION_DATA");
  }

  const bankSnapshot = {
    bankAccountId: String(bank._id),
    accountHolderName: String(bank.accountHolderName),
    bankName: String(bank.bankName),
    ifscCode: String(bank.ifscCode),
    accountNumberMasked: String(bank.accountNumberMasked),
    accountType: String(bank.accountType || "current"),
    partnerBankId: bank.partnerBankId ? String(bank.partnerBankId) : null,
    snapshotAt: new Date(),
  };

  const requestedAmountMinor = financialLedgerService.toMinorUnits(amountNum);
  const withdrawalNumber = generateWithdrawalNumber();
  const reservationJournalId = `JRN-WTH-RES-${withdrawalNumber}`;

  const session = await mongoose.startSession();

  try {
    let withdrawal;

    await session.withTransaction(async () => {
      // 4. Load & Verify Authoritative Wallet Balance within transaction
      let wallet = await VendorWallet.findOne({
        vendorId,
        currency: "INR",
      }).session(session);

      if (!wallet) {
        wallet = await financialLedgerService.syncVendorWalletBalances(
          vendorId,
          "INR",
          { session }
        );
      }

      const availableMinor = Math.max(
        0,
        Math.round(Number(wallet.availableBalance?.toString() || 0) * 100)
      );

      if (requestedAmountMinor > availableMinor) {
        throw new AppError(
          `Requested withdrawal amount (₹${amountNum.toFixed(2)}) exceeds available balance (₹${Number(wallet.availableBalance.toString()).toFixed(2)})`,
          400,
          "INSUFFICIENT_AVAILABLE_BALANCE"
        );
      }

      // 5. Create Withdrawal Request
      withdrawal = await withdrawalRequestRepository.create(
        {
          withdrawalNumber,
          vendorId,
          walletId: wallet._id,
          bankAccountId: bank._id,
          amount: financialLedgerService.toDecimal128(amountNum),
          amountMinor: requestedAmountMinor,
          currency: "INR",
          status: WITHDRAWAL_STATUSES.PENDING_REVIEW,
          idempotencyKey: normalizedIdempotencyKey,
          bankSnapshot,
          reservationJournalId,
          notes: notes ? String(notes).trim() : null,
        },
        { session }
      );

      // 6. Atomically reserve funds via balanced double-entry ledger journal (which updates VendorWallet projection)
      await financialLedgerService.postWithdrawalReservationJournal(withdrawal, {
        session,
        actorId: actorId || vendor.userId || vendor._id,
      });

      // 7. Immutable Audit Log
      await AuditLog.create(
        [
          {
            actorId: actorId || vendor.userId || vendor._id,
            targetId: withdrawal._id,
            action: "WITHDRAWAL_REQUESTED",
            entityType: "withdrawal_request",
            beforeState: null,
            afterState: {
              withdrawalNumber: withdrawal.withdrawalNumber,
              amount: amountNum.toFixed(2),
              currency: "INR",
              status: WITHDRAWAL_STATUSES.PENDING_REVIEW,
              bankAccountId: String(bank._id),
              bankName: bank.bankName,
              accountNumberMasked: bank.accountNumberMasked,
              ifscCode: bank.ifscCode,
              reservationJournalId,
            },
            reason: notes || null,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        ],
        { session }
      ).catch(() => {});
    });

    // Notify vendor asynchronously outside transaction
    sendWithdrawalNotification({
      vendorId,
      withdrawalNumber: withdrawal.withdrawalNumber,
      amount: amountNum.toFixed(2),
      currency: "INR",
      status: WITHDRAWAL_STATUSES.PENDING_REVIEW,
      maskedAccount: withdrawal.bankSnapshot.accountNumberMasked,
      bankName: withdrawal.bankSnapshot.bankName,
    }).catch((err) => {
      logger.warn({ err, withdrawalId: withdrawal._id }, "Failed to dispatch withdrawal notification");
    });

    return withdrawal;
  } finally {
    await session.endSession();
  }
};

/**
 * Vendor-facing: List own withdrawal requests
 */
const getVendorWithdrawals = async (
  vendorId,
  { page = 1, limit = 20, status = null } = {}
) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    withdrawalRequestRepository.findByVendorId(
      vendorId,
      { status, skip, limit: safeLimit }
    ),
    withdrawalRequestRepository.countByVendorId(vendorId, { status }),
  ]);

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

/**
 * Vendor-facing: Get specific withdrawal request by ID
 */
const getVendorWithdrawalById = async (vendorId, withdrawalId) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  if (!mongoose.isValidObjectId(withdrawalId)) {
    throw new AppError("Invalid withdrawal request ID", 400, "INVALID_WITHDRAWAL_ID");
  }

  const doc = await withdrawalRequestRepository.findById(withdrawalId);
  if (!doc || String(doc.vendorId) !== String(vendorId)) {
    throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
  }

  return doc;
};

/**
 * Admin-facing: List all withdrawal requests with search & filters
 */
const getAdminWithdrawals = async ({
  page = 1,
  limit = 20,
  status = null,
  vendorId = null,
  search = null,
  startDate = null,
  endDate = null,
} = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};

  if (status && Object.values(WITHDRAWAL_STATUSES).includes(status)) {
    filter.status = status;
  }

  if (vendorId && mongoose.isValidObjectId(vendorId)) {
    filter.vendorId = vendorId;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  if (search && String(search).trim()) {
    const s = String(search).trim();
    filter.$or = [
      { withdrawalNumber: { $regex: s, $options: "i" } },
      { "bankSnapshot.accountHolderName": { $regex: s, $options: "i" } },
      { "bankSnapshot.bankName": { $regex: s, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    withdrawalRequestRepository.findPaged({
      filter,
      skip,
      limit: safeLimit,
      sort: { createdAt: -1 },
    }),
    withdrawalRequestRepository.countFiltered(filter),
  ]);

  // Enrich with vendor metadata
  const vendorIds = [...new Set(items.map((i) => String(i.vendorId)))];
  const vendors = await Vendor.find({ _id: { $in: vendorIds } })
    .select("storeName businessEmail storeLogo")
    .lean();

  const vendorMap = new Map(vendors.map((v) => [String(v._id), v]));

  const enrichedItems = items.map((doc) => {
    const obj = doc.toObject();
    obj.vendor = vendorMap.get(String(doc.vendorId)) || null;
    return obj;
  });

  return {
    items: enrichedItems,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

/**
 * Admin-facing: Get full withdrawal request detail with snapshot and audit data
 */
const getAdminWithdrawalById = async (withdrawalId) => {
  if (!mongoose.isValidObjectId(withdrawalId)) {
    throw new AppError("Invalid withdrawal request ID", 400, "INVALID_WITHDRAWAL_ID");
  }

  const doc = await withdrawalRequestRepository.findById(withdrawalId);
  if (!doc) {
    throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
  }

  const [vendor, wallet, payout] = await Promise.all([
    Vendor.findById(doc.vendorId).select("storeName businessEmail phone isActive onboardingStatus").lean(),
    VendorWallet.findById(doc.walletId).lean(),
    doc.payoutId ? VendorPayout.findById(doc.payoutId).lean() : null,
  ]);

  const obj = doc.toObject();
  obj.vendor = vendor;
  obj.wallet = wallet;
  obj.payout = payout;

  return obj;
};

/**
 * Admin-facing: Approve a pending withdrawal request and create linked VendorPayout
 */
const approveWithdrawal = async ({
  withdrawalId,
  actorId,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!mongoose.isValidObjectId(withdrawalId)) {
    throw new AppError("Invalid withdrawal ID", 400, "INVALID_WITHDRAWAL_ID");
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const withdrawal = await withdrawalRequestRepository.findById(
        withdrawalId,
        { session }
      );

      if (!withdrawal) {
        throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
      }

      if (withdrawal.status !== WITHDRAWAL_STATUSES.PENDING_REVIEW) {
        throw new AppError(
          `Withdrawal cannot be approved in current status: ${withdrawal.status}`,
          409,
          "INVALID_WITHDRAWAL_STATUS"
        );
      }

      // Separation of Duties: Vendor cannot approve own withdrawal
      const vendor = await Vendor.findById(withdrawal.vendorId).session(session);
      if (vendor && String(vendor.userId) === String(actorId)) {
        throw new AppError(
          "Separation of duties violation: A vendor cannot approve their own withdrawal request",
          403,
          "SELF_APPROVAL_PROHIBITED"
        );
      }

      // Verify immutable destination snapshot exists
      if (!withdrawal.bankSnapshot || !withdrawal.bankSnapshot.accountNumberMasked) {
        throw new AppError("Withdrawal lacks a valid destination snapshot", 400, "INVALID_SNAPSHOT");
      }

      // Create linked VendorPayout
      const payoutNumber = vendorPayoutService.generatePayoutNumber();
      const [payout] = await VendorPayout.create(
        [
          {
            withdrawalRequestId: withdrawal._id,
            vendorId: withdrawal.vendorId,
            bankAccountId: withdrawal.bankAccountId,
            payoutNumber,
            provider: PAYMENT_GATEWAYS.RAZORPAY,
            amount: withdrawal.amount,
            currency: withdrawal.currency,
            status: VENDOR_PAYOUT_STATUSES.PENDING,
            idempotencyKey: `payout_wth_${withdrawal._id}`,
            metadata: {
              withdrawalId: String(withdrawal._id),
              withdrawalNumber: withdrawal.withdrawalNumber,
              bankAccountId: withdrawal.bankSnapshot.bankAccountId,
              accountHolderName: withdrawal.bankSnapshot.accountHolderName,
              bankName: withdrawal.bankSnapshot.bankName,
              ifscCode: withdrawal.bankSnapshot.ifscCode,
              accountNumberMasked: withdrawal.bankSnapshot.accountNumberMasked,
              accountType: withdrawal.bankSnapshot.accountType,
              snapshotAt: withdrawal.bankSnapshot.snapshotAt?.toISOString() || new Date().toISOString(),
            },
          },
        ],
        { session }
      );

      // Update Withdrawal Request state
      const updated = await withdrawalRequestRepository.updateById(
        withdrawal._id,
        {
          status: WITHDRAWAL_STATUSES.APPROVED,
          payoutId: payout._id,
          reviewedBy: actorId,
          reviewedAt: new Date(),
        },
        { session }
      );

      // Audit Log
      await AuditLog.create(
        [
          {
            actorId,
            targetId: withdrawal._id,
            action: "WITHDRAWAL_APPROVED",
            entityType: "withdrawal_request",
            beforeState: { status: withdrawal.status },
            afterState: {
              status: WITHDRAWAL_STATUSES.APPROVED,
              payoutId: String(payout._id),
              payoutNumber: payout.payoutNumber,
              reviewedBy: String(actorId),
            },
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        ],
        { session }
      ).catch(() => {});

      result = { withdrawal: updated, payout };
    });

    // Notify vendor
    sendWithdrawalNotification({
      vendorId: result.withdrawal.vendorId,
      withdrawalNumber: result.withdrawal.withdrawalNumber,
      amount: Number(result.withdrawal.amount.toString()).toFixed(2),
      currency: result.withdrawal.currency,
      status: WITHDRAWAL_STATUSES.APPROVED,
      maskedAccount: result.withdrawal.bankSnapshot.accountNumberMasked,
      bankName: result.withdrawal.bankSnapshot.bankName,
    }).catch(() => {});

    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * Admin-facing: Reject a pending withdrawal request and release reserved funds
 */
const rejectWithdrawal = async ({
  withdrawalId,
  rejectionReason,
  actorId,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!mongoose.isValidObjectId(withdrawalId)) {
    throw new AppError("Invalid withdrawal ID", 400, "INVALID_WITHDRAWAL_ID");
  }

  const trimmedReason = String(rejectionReason || "").trim();
  if (!trimmedReason || trimmedReason.length < 10) {
    throw new AppError(
      "A mandatory rejection reason of at least 10 characters is required",
      400,
      "REJECTION_REASON_REQUIRED"
    );
  }

  const session = await mongoose.startSession();

  try {
    let updated;

    await session.withTransaction(async () => {
      const withdrawal = await withdrawalRequestRepository.findById(
        withdrawalId,
        { session }
      );

      if (!withdrawal) {
        throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
      }

      if (withdrawal.status !== WITHDRAWAL_STATUSES.PENDING_REVIEW) {
        throw new AppError(
          `Withdrawal cannot be rejected in current status: ${withdrawal.status}`,
          409,
          "INVALID_WITHDRAWAL_STATUS"
        );
      }

      const releaseJournalId = `JRN-WTH-REL-${withdrawal.withdrawalNumber || withdrawal._id}`;

      // 1. Release reserved funds in double-entry ledger (which updates VendorWallet projection)
      await financialLedgerService.postWithdrawalReleaseJournal(withdrawal, {
        session,
        actorId,
        reason: trimmedReason,
      });

      // 2. Update Withdrawal Request document
      updated = await withdrawalRequestRepository.updateById(
        withdrawal._id,
        {
          status: WITHDRAWAL_STATUSES.REJECTED,
          rejectionReason: trimmedReason,
          releaseJournalId,
          reviewedBy: actorId,
          reviewedAt: new Date(),
        },
        { session }
      );

      // 3. Audit Log
      await AuditLog.create(
        [
          {
            actorId,
            targetId: withdrawal._id,
            action: "WITHDRAWAL_REJECTED",
            entityType: "withdrawal_request",
            beforeState: { status: withdrawal.status },
            afterState: {
              status: WITHDRAWAL_STATUSES.REJECTED,
              rejectionReason: trimmedReason,
              releaseJournalId,
              reviewedBy: String(actorId),
            },
            reason: trimmedReason,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        ],
        { session }
      ).catch(() => {});
    });

    // Notify vendor
    sendWithdrawalNotification({
      vendorId: updated.vendorId,
      withdrawalNumber: updated.withdrawalNumber,
      amount: Number(updated.amount.toString()).toFixed(2),
      currency: updated.currency,
      status: WITHDRAWAL_STATUSES.REJECTED,
      reason: trimmedReason,
      maskedAccount: updated.bankSnapshot.accountNumberMasked,
      bankName: updated.bankSnapshot.bankName,
    }).catch(() => {});

    return updated;
  } finally {
    await session.endSession();
  }
};

/**
 * Payout Processing Dispatch:
 * Dispatches an approved withdrawal to the payout adapter and marks it PROCESSING.
 */
const processWithdrawalPayout = async ({
  withdrawalId,
  actorId = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!mongoose.isValidObjectId(withdrawalId)) {
    throw new AppError("Invalid withdrawal ID", 400, "INVALID_WITHDRAWAL_ID");
  }

  const withdrawal = await withdrawalRequestRepository.findById(withdrawalId);
  if (!withdrawal) {
    throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
  }

  if (
    withdrawal.status !== WITHDRAWAL_STATUSES.APPROVED &&
    withdrawal.status !== WITHDRAWAL_STATUSES.FAILED
  ) {
    throw new AppError(
      `Cannot initiate payout processing for withdrawal in status: ${withdrawal.status}`,
      409,
      "INVALID_WITHDRAWAL_STATUS"
    );
  }

  if (!withdrawal.payoutId) {
    throw new AppError("No linked payout record found for this withdrawal", 400, "MISSING_PAYOUT_RECORD");
  }

  // 1. Dispatch through clearly marked sandbox transfer adapter
  const transferResult = await payoutSandboxAdapter.initiateTransfer({
    payoutId: withdrawal.payoutId,
    amount: Number(withdrawal.amount.toString()),
    currency: withdrawal.currency,
    bankSnapshot: withdrawal.bankSnapshot,
    reference: `TXN-${withdrawal.withdrawalNumber}`,
  });

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // If adapter simulated failure immediately
      if (!transferResult.success) {
        await VendorPayout.findByIdAndUpdate(
          withdrawal.payoutId,
          {
            status: VENDOR_PAYOUT_STATUSES.FAILED,
            failureReason: transferResult.failureReason || "Payout transfer rejected by provider",
          },
          { session }
        );

        // Release reserved funds back to available (which syncs VendorWallet projection)
        await financialLedgerService.postWithdrawalReleaseJournal(withdrawal, {
          session,
          actorId,
          reason: transferResult.failureReason,
        });

        result = await withdrawalRequestRepository.updateById(
          withdrawal._id,
          {
            status: WITHDRAWAL_STATUSES.FAILED,
            failureReason: transferResult.failureReason,
            processedAt: new Date(),
          },
          { session }
        );
        return;
      }

      // Transition linked VendorPayout to PROCESSING
      await VendorPayout.findByIdAndUpdate(
        withdrawal.payoutId,
        {
          status: VENDOR_PAYOUT_STATUSES.PROCESSING,
          providerReference: transferResult.providerReference,
          processedAt: new Date(),
        },
        { session }
      );

      // Transition WithdrawalRequest to PROCESSING
      result = await withdrawalRequestRepository.updateById(
        withdrawal._id,
        {
          status: WITHDRAWAL_STATUSES.PROCESSING,
          processedAt: new Date(),
          metadata: {
            providerReference: transferResult.providerReference,
            adapterMode: transferResult.mode,
          },
        },
        { session }
      );

      await AuditLog.create(
        [
          {
            actorId: actorId || withdrawal.vendorId,
            targetId: withdrawal._id,
            action: "PAYOUT_PROCESSING_DISPATCHED",
            entityType: "withdrawal_request",
            beforeState: { status: withdrawal.status },
            afterState: {
              status: WITHDRAWAL_STATUSES.PROCESSING,
              providerReference: transferResult.providerReference,
              adapterMode: transferResult.mode,
            },
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        ],
        { session }
      ).catch(() => {});
    });

    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * Payout Completion:
 * Confirms definitive transfer completion, records provider reference,
 * and posts disbursement double-entry journal to clear reserved funds.
 */
const markWithdrawalPaid = async ({
  withdrawalId,
  providerReference = null,
  actorId = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!mongoose.isValidObjectId(withdrawalId)) {
    throw new AppError("Invalid withdrawal ID", 400, "INVALID_WITHDRAWAL_ID");
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const withdrawal = await withdrawalRequestRepository.findById(
        withdrawalId,
        { session }
      );

      if (!withdrawal) {
        throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
      }

      if (
        withdrawal.status !== WITHDRAWAL_STATUSES.PROCESSING &&
        withdrawal.status !== WITHDRAWAL_STATUSES.APPROVED
      ) {
        throw new AppError(
          `Withdrawal cannot be marked paid in current status: ${withdrawal.status}`,
          409,
          "INVALID_WITHDRAWAL_STATUS"
        );
      }

      const payout = await VendorPayout.findById(withdrawal.payoutId).session(session);
      if (!payout) {
        throw new AppError("Linked payout record not found", 404, "PAYOUT_NOT_FOUND");
      }

      const ref = providerReference || payout.providerReference || `UTR-${Date.now()}`;
      const disbursementJournalId = `JRN-PAY-DISB-${payout.payoutNumber || payout._id}`;

      // 1. Post disbursement double-entry journal: DEBIT 2030 (Reserved), CREDIT 1020 (Clearing)
      await financialLedgerService.postPayoutDisbursementJournal(payout, {
        session,
        actorId,
      });

      // 2. Update VendorPayout to PAID
      await VendorPayout.findByIdAndUpdate(
        payout._id,
        {
          status: VENDOR_PAYOUT_STATUSES.PAID,
          paidAt: new Date(),
          providerReference: ref,
          failureReason: null,
        },
        { session }
      );

      // 3. Update WithdrawalRequest to COMPLETED
      result = await withdrawalRequestRepository.updateById(
        withdrawal._id,
        {
          status: WITHDRAWAL_STATUSES.COMPLETED,
          completedAt: new Date(),
          disbursementJournalId,
          metadata: {
            providerReference: ref,
          },
        },
        { session }
      );

      // 4. Audit Log
      await AuditLog.create(
        [
          {
            actorId: actorId || withdrawal.vendorId,
            targetId: withdrawal._id,
            action: "WITHDRAWAL_COMPLETED",
            entityType: "withdrawal_request",
            beforeState: { status: withdrawal.status },
            afterState: {
              status: WITHDRAWAL_STATUSES.COMPLETED,
              providerReference: ref,
              disbursementJournalId,
            },
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        ],
        { session }
      ).catch(() => {});
    });

    // Notify vendor
    sendWithdrawalNotification({
      vendorId: result.vendorId,
      withdrawalNumber: result.withdrawalNumber,
      amount: Number(result.amount.toString()).toFixed(2),
      currency: result.currency,
      status: WITHDRAWAL_STATUSES.COMPLETED,
      maskedAccount: result.bankSnapshot.accountNumberMasked,
      bankName: result.bankSnapshot.bankName,
    }).catch(() => {});

    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * Definitive Payout Failure:
 * Records bank rail rejection, releases reserved funds back to available balance,
 * and notifies vendor.
 */
const markWithdrawalFailed = async ({
  withdrawalId,
  failureReason = "Bank transfer failed",
  actorId = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!mongoose.isValidObjectId(withdrawalId)) {
    throw new AppError("Invalid withdrawal ID", 400, "INVALID_WITHDRAWAL_ID");
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const withdrawal = await withdrawalRequestRepository.findById(
        withdrawalId,
        { session }
      );

      if (!withdrawal) {
        throw new AppError("Withdrawal request not found", 404, "WITHDRAWAL_NOT_FOUND");
      }

      if (
        withdrawal.status !== WITHDRAWAL_STATUSES.PROCESSING &&
        withdrawal.status !== WITHDRAWAL_STATUSES.APPROVED
      ) {
        throw new AppError(
          `Withdrawal cannot be marked failed in current status: ${withdrawal.status}`,
          409,
          "INVALID_WITHDRAWAL_STATUS"
        );
      }

      const payout = await VendorPayout.findById(withdrawal.payoutId).session(session);
      const releaseJournalId = `JRN-PAY-REL-${payout ? payout.payoutNumber : withdrawal.withdrawalNumber}`;

      // 1. Release reserved funds back to available balance
      if (payout) {
        await financialLedgerService.postPayoutReleaseJournal(payout, {
          session,
          actorId,
        });

        await VendorPayout.findByIdAndUpdate(
          payout._id,
          {
            status: VENDOR_PAYOUT_STATUSES.FAILED,
            failureReason: String(failureReason),
          },
          { session }
        );
      } else {
        await financialLedgerService.postWithdrawalReleaseJournal(withdrawal, {
          session,
          actorId,
          reason: failureReason,
        });
      }

      // 2. Update WithdrawalRequest to FAILED
      result = await withdrawalRequestRepository.updateById(
        withdrawal._id,
        {
          status: WITHDRAWAL_STATUSES.FAILED,
          failureReason: String(failureReason),
          releaseJournalId,
        },
        { session }
      );

      // 3. Audit Log
      await AuditLog.create(
        [
          {
            actorId: actorId || withdrawal.vendorId,
            targetId: withdrawal._id,
            action: "WITHDRAWAL_PAYOUT_FAILED",
            entityType: "withdrawal_request",
            beforeState: { status: withdrawal.status },
            afterState: {
              status: WITHDRAWAL_STATUSES.FAILED,
              failureReason: String(failureReason),
              releaseJournalId,
            },
            reason: String(failureReason),
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        ],
        { session }
      ).catch(() => {});
    });

    // Notify vendor
    sendWithdrawalNotification({
      vendorId: result.vendorId,
      withdrawalNumber: result.withdrawalNumber,
      amount: Number(result.amount.toString()).toFixed(2),
      currency: result.currency,
      status: WITHDRAWAL_STATUSES.FAILED,
      reason: failureReason,
      maskedAccount: result.bankSnapshot.accountNumberMasked,
      bankName: result.bankSnapshot.bankName,
    }).catch(() => {});

    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * Internal Notification Dispatcher
 * Dispatches notification ensuring zero plaintext sensitive bank account details.
 */
const sendWithdrawalNotification = async ({
  vendorId,
  withdrawalNumber,
  amount,
  currency = "INR",
  status,
  reason = null,
  maskedAccount = null,
  bankName = null,
}) => {
  try {
    const vendor = await Vendor.findById(vendorId).select("storeName businessEmail").lean();
    if (!vendor || !vendor.businessEmail) return;

    let subject = `Buybox Marketplace - Withdrawal Update #${withdrawalNumber}`;
    let messageText = `Your withdrawal request #${withdrawalNumber} for ${currency} ${amount} is currently ${status}.`;

    if (status === WITHDRAWAL_STATUSES.PENDING_REVIEW) {
      subject = `Buybox Marketplace - Withdrawal Request Received (#${withdrawalNumber})`;
      messageText = `Your withdrawal request #${withdrawalNumber} for ${currency} ${amount} has been received and funds reserved. Destination: ${bankName} (${maskedAccount}).`;
    } else if (status === WITHDRAWAL_STATUSES.APPROVED) {
      subject = `Buybox Marketplace - Withdrawal Approved (#${withdrawalNumber})`;
      messageText = `Your withdrawal request #${withdrawalNumber} for ${currency} ${amount} has been approved and queued for payout.`;
    } else if (status === WITHDRAWAL_STATUSES.REJECTED) {
      subject = `Buybox Marketplace - Withdrawal Request Rejected (#${withdrawalNumber})`;
      messageText = `Your withdrawal request #${withdrawalNumber} for ${currency} ${amount} was rejected: ${reason}. Reserved funds have been restored to your available balance.`;
    } else if (status === WITHDRAWAL_STATUSES.COMPLETED) {
      subject = `Buybox Marketplace - Payout Completed (#${withdrawalNumber})`;
      messageText = `Your payout for withdrawal #${withdrawalNumber} of ${currency} ${amount} has been successfully disbursed to ${bankName} (${maskedAccount}).`;
    } else if (status === WITHDRAWAL_STATUSES.FAILED) {
      subject = `Buybox Marketplace - Payout Transfer Failed (#${withdrawalNumber})`;
      messageText = `The bank transfer for withdrawal #${withdrawalNumber} failed: ${reason}. Reserved funds have been restored to your available balance.`;
    }

    await notificationService.sendEmail({
      to: vendor.businessEmail,
      subject,
      text: messageText,
      html: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #0f172a;">${subject}</h2>
        <p>${messageText}</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">This is an automated notification from Buybox Marketplace Financial System.</p>
      </div>`,
    });
  } catch (err) {
    logger.warn({ err, vendorId }, "Failed to deliver withdrawal notification");
  }
};

module.exports = {
  requestWithdrawal,
  getVendorWithdrawals,
  getVendorWithdrawalById,
  getAdminWithdrawals,
  getAdminWithdrawalById,
  approveWithdrawal,
  rejectWithdrawal,
  processWithdrawalPayout,
  markWithdrawalPaid,
  markWithdrawalFailed,
  generateWithdrawalNumber,
};
