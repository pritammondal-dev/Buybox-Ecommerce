const mongoose = require("mongoose");

const AppError = require("../errors/AppError");

const VendorPayout = require("../models/VendorPayout");

const {
  VENDOR_PAYOUT_STATUSES,
} = require("../models/VendorPayout");

const { VendorSettlement } = require("../models/VendorSettlement");
const Vendor = require("../models/Vendor");
const AuditLog = require("../models/AuditLog");

const vendorPayoutRepository = require("../repositories/vendor-payout.repository");

const vendorSettlementRepository = require("../repositories/vendor-settlement.repository");

const {
  PAYMENT_GATEWAYS,
} = require("../constants/payment.constants");

const toDecimal128 = (value) => {
  if (value instanceof mongoose.Types.Decimal128) {
    return value;
  }

  return mongoose.Types.Decimal128.fromString(
    Number(value).toFixed(2)
  );
};

const normalizeCurrency = (currency) => {
  return String(currency).trim().toUpperCase();
};

const generatePayoutNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase();

  return `PAYOUT-${timestamp}-${random}`;
};

const calculatePayoutAmount = (settlement) => {
  const amount = Number(settlement.netPayable.toString());

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(
      "Settlement has no payable balance",
      400,
      "SETTLEMENT_NOT_PAYABLE"
    );
  }

  return amount.toFixed(2);
};

const createPayout = async ({
  settlementId,
  vendorId,
  provider = PAYMENT_GATEWAYS.RAZORPAY,
  idempotencyKey = null,
  metadata = {},
  actorId = null,
}) => {
  if (!mongoose.isValidObjectId(settlementId)) {
    throw new AppError(
      "Invalid settlement ID",
      400,
      "INVALID_SETTLEMENT_ID"
    );
  }

  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError(
      "Invalid vendor ID",
      400,
      "INVALID_VENDOR_ID"
    );
  }

  if (!idempotencyKey || !String(idempotencyKey).trim()) {
    throw new AppError(
      "Idempotency-Key is required",
      400,
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }

  const existing = await vendorPayoutRepository.findByIdempotencyKey(
    vendorId,
    idempotencyKey
  );

  if (existing) {
    if (existing.settlementId.toString() !== settlementId.toString()) {
      throw new AppError(
        "Idempotency key is already associated with another payout",
        409,
        "IDEMPOTENCY_KEY_CONFLICT"
      );
    }

    return existing;
  }

  const session = await mongoose.startSession();

  try {
    let payout;

    await session.withTransaction(async () => {
      const settlement = await vendorSettlementRepository.findById(
        settlementId,
        { session }
      );

      if (!settlement) {
        throw new AppError(
          "Settlement not found",
          404,
          "SETTLEMENT_NOT_FOUND"
        );
      }

      if (settlement.vendorId.toString() !== vendorId.toString()) {
        throw new AppError(
          "Settlement not found",
          404,
          "SETTLEMENT_NOT_FOUND"
        );
      }

      if (settlement.status !== "payable") {
        throw new AppError(
          "Settlement is not payable",
          409,
          "SETTLEMENT_NOT_PAYABLE"
        );
      }

      const existingSettlementPayout =
        await vendorPayoutRepository.findBySettlementId(
          settlementId,
          { session }
        );

      if (existingSettlementPayout) {
        if (
          existingSettlementPayout.vendorId.toString() !==
          vendorId.toString()
        ) {
          throw new AppError(
            "Settlement payout not found",
            404,
            "PAYOUT_NOT_FOUND"
          );
        }

        payout = existingSettlementPayout;
        return;
      }

      // 1. Validate Vendor Eligibility for Payouts
      const vendor = await Vendor.findById(settlement.vendorId).session(session);
      if (!vendor) {
        throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
      }

      if (
        !vendor.isActive ||
        (vendor.onboardingStatus && vendor.onboardingStatus !== "approved") ||
        vendor.onboardingStatus === "suspended" ||
        vendor.onboardingStatus === "rejected"
      ) {
        throw new AppError(
          "Vendor is not eligible for payouts",
          400,
          "VENDOR_NOT_ELIGIBLE_FOR_PAYOUT"
        );
      }

      // 2. Validate Active Approved Bank Account Destination
      const VendorBankAccount = mongoose.model("VendorBankAccount");
      const activeBank = await VendorBankAccount.findOne({
        vendorId: settlement.vendorId,
        isActive: true,
        status: "approved",
        deletedAt: null,
      }).session(session);

      if (!activeBank) {
        const anyBank = await VendorBankAccount.findOne({
          vendorId: settlement.vendorId,
          deletedAt: null,
        }).session(session);

        let errorCode = "NO_ACTIVE_BANK_ACCOUNT";
        let errorMessage = "Vendor has no active approved bank account for payouts";

        if (anyBank) {
          if (anyBank.status === "pending" || anyBank.status === "under_review") {
            errorCode = "BANK_ACCOUNT_PENDING_APPROVAL";
            errorMessage = "Vendor bank account is pending approval";
          } else if (anyBank.status === "rejected") {
            errorCode = "BANK_ACCOUNT_REJECTED";
            errorMessage = "Vendor bank account has been rejected";
          }
        } else {
          errorMessage = "Vendor has no bank account configured for payouts";
        }

        await AuditLog.create([
          {
            actorId: actorId || vendor.userId,
            targetId: settlement._id,
            action: "PAYOUT_DESTINATION_VALIDATION_FAILED",
            entityType: "vendor_payout",
            beforeState: null,
            afterState: {
              vendorId: String(settlement.vendorId),
              settlementId: String(settlement._id),
              reason: errorMessage,
              errorCode,
            },
          },
        ]).catch(() => {});

        throw new AppError(errorMessage, 400, errorCode);
      }

      // 3. If explicit bankAccountId provided in metadata, verify it strictly matches activeBank
      if (metadata?.bankAccountId && String(metadata.bankAccountId) !== String(activeBank._id)) {
        const requestedBank = await VendorBankAccount.findById(metadata.bankAccountId).session(session);
        if (!requestedBank || String(requestedBank.vendorId) !== String(settlement.vendorId)) {
          throw new AppError(
            "Specified bank account does not belong to this vendor",
            400,
            "BANK_ACCOUNT_MISMATCH"
          );
        }
        if (requestedBank.deletedAt) {
          throw new AppError(
            "Specified bank account is archived",
            400,
            "BANK_ACCOUNT_ARCHIVED"
          );
        }
        if (requestedBank.status !== "approved") {
          throw new AppError(
            "Specified bank account is not approved",
            400,
            "BANK_ACCOUNT_NOT_APPROVED"
          );
        }
        if (!requestedBank.isActive) {
          throw new AppError(
            "Specified bank account is not the active payout destination",
            400,
            "BANK_ACCOUNT_NOT_ACTIVE"
          );
        }
      }

      // 4. Validate complete destination details
      if (
        !activeBank.bankName ||
        !activeBank.accountHolderName ||
        !activeBank.accountNumberMasked ||
        !activeBank.ifscCode
      ) {
        throw new AppError(
          "Bank account destination data is incomplete",
          400,
          "INCOMPLETE_DESTINATION_DATA"
        );
      }

      const snapshotTimestamp = new Date().toISOString();
      const payoutMetadata = { ...(metadata || {}) };
      payoutMetadata.bankAccountId = String(activeBank._id);
      payoutMetadata.vendorId = String(activeBank.vendorId);
      payoutMetadata.beneficiaryName = String(activeBank.accountHolderName);
      payoutMetadata.accountHolderName = String(activeBank.accountHolderName);
      payoutMetadata.bankName = String(activeBank.bankName);
      payoutMetadata.ifscCode = String(activeBank.ifscCode);
      payoutMetadata.accountNumberMasked = String(activeBank.accountNumberMasked);
      payoutMetadata.accountType = String(activeBank.accountType || "current");
      payoutMetadata.snapshotAt = snapshotTimestamp;

      const amount = calculatePayoutAmount(settlement);

      payout = await vendorPayoutRepository.create(
        {
          settlementId: settlement._id,
          vendorId: settlement.vendorId,
          bankAccountId: activeBank._id,
          payoutNumber: generatePayoutNumber(),
          provider,
          amount: toDecimal128(amount),
          currency: normalizeCurrency(settlement.currency),
          status: VENDOR_PAYOUT_STATUSES.PENDING,
          idempotencyKey,
          metadata: payoutMetadata,
        },
        { session }
      );

      // Phase VW-03: Atomically reserve available funds in double-entry ledger
      const financialLedgerService = require("./financial-ledger.service");
      await financialLedgerService.postPayoutReservationJournal(payout, { session, actorId });

      await AuditLog.create([
        {
          actorId: actorId || vendor.userId || vendor._id,
          targetId: payout._id,
          action: "PAYOUT_CREATED",
          entityType: "vendor_payout",
          beforeState: null,
          afterState: {
            payoutNumber: payout.payoutNumber,
            amount: String(amount),
            currency: normalizeCurrency(settlement.currency),
            status: VENDOR_PAYOUT_STATUSES.PENDING,
            bankAccountId: String(activeBank._id),
            bankName: String(activeBank.bankName),
            accountNumberMasked: String(activeBank.accountNumberMasked),
            ifscCode: String(activeBank.ifscCode),
            snapshotAt: snapshotTimestamp,
          },
        },
      ], { session }).catch(() => {});
    });

    return payout;
  } catch (error) {
    if (error?.code === 11000) {
      const retry = await vendorPayoutRepository.findByIdempotencyKey(
        vendorId,
        idempotencyKey
      );

      if (retry) {
        return retry;
      }

      throw new AppError(
        "Payout already exists for this settlement",
        409,
        "PAYOUT_ALREADY_EXISTS"
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

const transitionPayoutStatus = async ({
  payoutId,
  nextStatus,
  providerReference = null,
  failureReason = null,
  actorId = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!mongoose.isValidObjectId(payoutId)) {
    throw new AppError(
      "Invalid payout ID",
      400,
      "INVALID_PAYOUT_ID"
    );
  }

  const allowedTransitions = {
    [VENDOR_PAYOUT_STATUSES.PENDING]: [
      VENDOR_PAYOUT_STATUSES.PROCESSING,
      VENDOR_PAYOUT_STATUSES.CANCELLED,
    ],

    [VENDOR_PAYOUT_STATUSES.PROCESSING]: [
      VENDOR_PAYOUT_STATUSES.PAID,
      VENDOR_PAYOUT_STATUSES.FAILED,
    ],

    [VENDOR_PAYOUT_STATUSES.FAILED]: [
      VENDOR_PAYOUT_STATUSES.PROCESSING,
      VENDOR_PAYOUT_STATUSES.CANCELLED,
    ],

    [VENDOR_PAYOUT_STATUSES.PAID]: [],
    [VENDOR_PAYOUT_STATUSES.CANCELLED]: [],
  };

  const session = await mongoose.startSession();

  try {
    let payout;

    await session.withTransaction(async () => {
      payout = await vendorPayoutRepository.findById(
        payoutId,
        { session }
      );

      if (!payout) {
        throw new AppError(
          "Payout not found",
          404,
          "PAYOUT_NOT_FOUND"
        );
      }

      if (payout.status === nextStatus) {
        return;
      }

      const allowed =
        allowedTransitions[payout.status] || [];

      if (!allowed.includes(nextStatus)) {
        throw new AppError(
          `Invalid payout status transition: ${payout.status} -> ${nextStatus}`,
          409,
          "INVALID_PAYOUT_STATUS_TRANSITION"
        );
      }

      // Enforce snapshot preservation: payout must possess valid destination data
      const snapshotBankId =
        payout.bankAccountId ||
        (payout.metadata?.get
          ? payout.metadata.get("bankAccountId")
          : payout.metadata?.bankAccountId);

      if (!snapshotBankId) {
        throw new AppError(
          "Payout cannot be processed without an authoritative destination snapshot",
          400,
          "INVALID_PAYOUT_SNAPSHOT"
        );
      }

      const previousStatus = payout.status;
      const previousRetryCount = payout.retryCount;

      const update = {
        status: nextStatus,
      };

      if (nextStatus === VENDOR_PAYOUT_STATUSES.PROCESSING) {
        update.processedAt = new Date();

        if (previousStatus === VENDOR_PAYOUT_STATUSES.FAILED) {
          update.retryCount = previousRetryCount + 1;
        }
      }

      if (nextStatus === VENDOR_PAYOUT_STATUSES.PAID) {
        update.paidAt = new Date();

        if (providerReference) {
          update.providerReference = providerReference;
        }

        update.failureReason = null;
      }

      if (nextStatus === VENDOR_PAYOUT_STATUSES.FAILED) {
        update.failureReason = failureReason || "Payout failed";
      }

      if (nextStatus === VENDOR_PAYOUT_STATUSES.CANCELLED) {
        update.cancelledAt = new Date();
      }

      payout = await vendorPayoutRepository.updateById(
        payoutId,
        update,
        { session }
      );

      // Audit status transition
      let resolvedActorId = actorId;
      if (!resolvedActorId) {
        const vendor = await Vendor.findById(payout.vendorId).session(session);
        resolvedActorId = vendor?.userId || payout.vendorId;
      }

      let actionName = "PAYOUT_STATUS_CHANGED";
      if (nextStatus === VENDOR_PAYOUT_STATUSES.PROCESSING) {
        actionName =
          previousStatus === VENDOR_PAYOUT_STATUSES.FAILED
            ? "PAYOUT_RETRY"
            : "PAYOUT_PROCESSING";
      } else if (nextStatus === VENDOR_PAYOUT_STATUSES.PAID) {
        actionName = "PAYOUT_PAID";
      } else if (nextStatus === VENDOR_PAYOUT_STATUSES.FAILED) {
        actionName = "PAYOUT_FAILED";
      } else if (nextStatus === VENDOR_PAYOUT_STATUSES.CANCELLED) {
        actionName = "PAYOUT_CANCELLED";
      }

      await AuditLog.create([
        {
          actorId: resolvedActorId,
          targetId: payout._id,
          action: actionName,
          entityType: "vendor_payout",
          beforeState: {
            status: payout.status,
            retryCount: payout.retryCount,
          },
          afterState: {
            status: nextStatus,
            retryCount:
              update.retryCount !== undefined
                ? update.retryCount
                : payout.retryCount,
            providerReference:
              update.providerReference || payout.providerReference,
            failureReason: update.failureReason || null,
            bankAccountId: String(snapshotBankId),
          },
          reason: failureReason || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      ], { session }).catch(() => {});

      if (
        nextStatus === VENDOR_PAYOUT_STATUSES.PROCESSING &&
        previousStatus === VENDOR_PAYOUT_STATUSES.FAILED
      ) {
        // Phase VW-03: Re-reserve funds on payout retry
        const financialLedgerService = require("./financial-ledger.service");
        await financialLedgerService.postPayoutReservationJournal(payout, { session, actorId });
      }

      if (nextStatus === VENDOR_PAYOUT_STATUSES.PAID) {
        // Phase VW-03: Post payout disbursement double-entry journal
        const financialLedgerService = require("./financial-ledger.service");
        await financialLedgerService.postPayoutDisbursementJournal(payout, { session, actorId });

        const settlement = await vendorSettlementRepository.findById(
          payout.settlementId,
          { session }
        );

        if (!settlement) {
          throw new AppError(
            "Settlement not found",
            404,
            "SETTLEMENT_NOT_FOUND"
          );
        }

        if (settlement.status !== "paid") {
          await vendorSettlementRepository.updateById(
            settlement._id,
            {
              status: "paid",
              paidAt: new Date(),
              payoutReference: payout.providerReference || payout.payoutNumber,
            },
            { session }
          );
        }
      }

      if (
        nextStatus === VENDOR_PAYOUT_STATUSES.FAILED ||
        nextStatus === VENDOR_PAYOUT_STATUSES.CANCELLED
      ) {
        // Phase VW-03: Restore reserved payout funds back to available balance
        const financialLedgerService = require("./financial-ledger.service");
        await financialLedgerService.postPayoutReleaseJournal(payout, { session, actorId });
      }
    });

    return payout;
  } finally {
    await session.endSession();
  }
};

const markProcessing = async (payoutId) => {
  return transitionPayoutStatus({
    payoutId,
    nextStatus: VENDOR_PAYOUT_STATUSES.PROCESSING,
  });
};

const markPaid = async ({
  payoutId,
  providerReference,
}) => {
  return transitionPayoutStatus({
    payoutId,
    nextStatus: VENDOR_PAYOUT_STATUSES.PAID,
    providerReference,
  });
};

const markFailed = async ({
  payoutId,
  failureReason,
}) => {
  return transitionPayoutStatus({
    payoutId,
    nextStatus: VENDOR_PAYOUT_STATUSES.FAILED,
    failureReason,
  });
};

const retryPayout = async (payoutId, options = {}) => {
  return transitionPayoutStatus({
    payoutId,
    nextStatus: VENDOR_PAYOUT_STATUSES.PROCESSING,
    actorId: options.actorId,
  });
};

const getPayoutById = async (payoutId) => {
  if (!mongoose.isValidObjectId(payoutId)) {
    throw new AppError("Invalid payout ID", 400, "INVALID_PAYOUT_ID");
  }

  const payout = await vendorPayoutRepository.findById(payoutId);

  if (!payout) {
    throw new AppError(
      "Payout not found",
      404,
      "PAYOUT_NOT_FOUND"
    );
  }

  return payout;
};

const getPayoutsByVendorId = async (vendorId) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  return vendorPayoutRepository.findByVendorId(vendorId);
};

module.exports = {
  createPayout,
  getPayoutById,
  getPayoutsByVendorId,
  transitionPayoutStatus,
  markProcessing,
  markPaid,
  markFailed,
  retryPayout,
  generatePayoutNumber,
  calculatePayoutAmount,
};