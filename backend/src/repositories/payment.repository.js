const mongoose = require("mongoose");

const Payment = require("../models/Payment");

const toDecimal128 = (amount) => {
  return mongoose.Types.Decimal128.fromString(
    amount.toString()
  );
};

const create = async (data, options = {}) => {
  const documents = await Payment.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findById = async (id, options = {}) => {
  return Payment.findById(id).session(
    options.session || null
  );
};

const findByOrderId = async (
  orderId,
  options = {}
) => {
  return Payment.find({
    orderId,
  })
    .session(options.session || null)
    .sort({
      createdAt: -1,
    });
};

const findLatestByOrderId = async (
  orderId,
  options = {}
) => {
  return Payment.findOne({
    orderId,
  })
    .session(options.session || null)
    .sort({
      createdAt: -1,
    });
};

const findByGatewayOrderId = async (
  gateway,
  gatewayOrderId,
  options = {}
) => {
  return Payment.findOne({
    gateway,
    gatewayOrderId,
  }).session(options.session || null);
};

const findByGatewayPaymentId = async (
  gateway,
  gatewayPaymentId,
  options = {}
) => {
  return Payment.findOne({
    gateway,
    gatewayPaymentId,
  }).session(options.session || null);
};

const findByIdempotencyKey = async (
  gateway,
  idempotencyKey,
  options = {}
) => {
  return Payment.findOne({
    gateway,
    idempotencyKey,
  }).session(options.session || null);
};

const updateById = async (
  id,
  data,
  options = {}
) => {
  return Payment.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const reserveRefundAmount = async (
  paymentId,
  amount,
  options = {}
) => {
  const decimalAmount = toDecimal128(amount);

  return Payment.findOneAndUpdate(
    {
      _id: paymentId,
      $expr: {
        $lte: [
          {
            $add: [
              {
                $ifNull: [
                  "$refundedAmount",
                  mongoose.Types.Decimal128.fromString("0"),
                ],
              },
              {
                $ifNull: [
                  "$refundReservedAmount",
                  mongoose.Types.Decimal128.fromString("0"),
                ],
              },
              decimalAmount,
            ],
          },
          "$amount",
        ],
      },
    },
    {
      $inc: {
        refundReservedAmount: decimalAmount,
      },
    },
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const releaseRefundReservation = async (
  paymentId,
  amount,
  options = {}
) => {
  const decimalAmount = toDecimal128(amount);
  const negativeDecimalAmount = toDecimal128(
    `-${decimalAmount.toString().replace(/^-/, "")}`
  );

  return Payment.findOneAndUpdate(
    {
      _id: paymentId,
      $expr: {
        $gte: [
          {
            $ifNull: [
              "$refundReservedAmount",
              mongoose.Types.Decimal128.fromString("0"),
            ],
          },
          decimalAmount,
        ],
      },
    },
    {
      $inc: {
        refundReservedAmount: negativeDecimalAmount,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
      session: options.session,
    }
  );
};

module.exports = {
  create,
  findById,
  findByOrderId,
  findLatestByOrderId,
  findByGatewayOrderId,
  findByGatewayPaymentId,
  findByIdempotencyKey,
  updateById,
  reserveRefundAmount,
  releaseRefundReservation,
};