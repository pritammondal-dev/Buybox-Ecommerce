const mongoose = require("mongoose");

const AppError = require("../errors/AppError");

const VendorPayout = require("../models/VendorPayout");

const {
  VENDOR_PAYOUT_STATUSES,
} = require("../models/VendorPayout");

const { VendorSettlement } = require("../models/VendorSettlement");

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

      const amount = calculatePayoutAmount(settlement);

      payout = await vendorPayoutRepository.create(
        {
          settlementId: settlement._id,
          vendorId: settlement.vendorId,
          payoutNumber: generatePayoutNumber(),
          provider,
          amount: toDecimal128(amount),
          currency: normalizeCurrency(settlement.currency),
          status: VENDOR_PAYOUT_STATUSES.PENDING,
          idempotencyKey,
          metadata,
        },
        { session }
      );
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

      const update = {
        status: nextStatus,
      };

      if (nextStatus === VENDOR_PAYOUT_STATUSES.PROCESSING) {
        update.processedAt = new Date();

        if (payout.status === VENDOR_PAYOUT_STATUSES.FAILED) {
          update.retryCount = payout.retryCount + 1;
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

      if (nextStatus === VENDOR_PAYOUT_STATUSES.PAID) {
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
            },
            { session }
          );
        }
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

const retryPayout = async (payoutId) => {
  return markProcessing(payoutId);
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