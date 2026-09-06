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

module.exports = {
  createSettlement,
  markProcessing,
  markPayable,
  calculateNetPayable,
  generateSettlementNumber,
};