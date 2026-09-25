const mongoose = require("mongoose");
const Refund = require("../models/Refund");
const refundService = require("../services/refund.service");
const apiResponse = require("../utils/apiResponse");
const AppError = require("../errors/AppError");

const createRefund = async (req, res) => {
  const idempotencyKey = req.get("Idempotency-Key");

  const refund = await refundService.createRefund({
    orderId: req.params.orderId,
    userId: req.user.id,
    user: req.user,
    amount: req.body.amount,
    reason: req.body.reason,
    idempotencyKey,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Refund created successfully",
    data: refund,
  });
};

const listRefunds = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, orderId, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (orderId && mongoose.isValidObjectId(orderId)) {
      filter.orderId = orderId;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [refunds, total] = await Promise.all([
      Refund.find(filter)
        .populate("orderId", "orderNumber grandTotal status")
        .populate("paymentId", "gateway transactionId status")
        .populate({
          path: "customerId",
          select: "userId",
          populate: { path: "userId", select: "firstName lastName email" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Refund.countDocuments(filter),
    ]);

    const formatted = refunds.map((r) => ({
      id: r._id,
      amount: r.amount ? parseFloat(r.amount.toString()) : 0,
      currency: r.currency,
      status: r.status,
      gateway: r.gateway,
      gatewayRefundId: r.gatewayRefundId,
      reason: r.reason,
      createdAt: r.createdAt,
      order: r.orderId,
      payment: r.paymentId,
      customer: r.customerId?.userId || null,
    }));

    return apiResponse.sendSuccess(res, {
      message: "Refunds retrieved successfully",
      data: {
        refunds: formatted,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getRefundById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid refund ID", 400, "INVALID_ID");
    }

    const refund = await Refund.findById(id)
      .populate("orderId", "orderNumber grandTotal status customerId")
      .populate("paymentId", "gateway transactionId status amount")
      .populate({
        path: "customerId",
        select: "userId",
        populate: { path: "userId", select: "firstName lastName email" },
      })
      .lean();

    if (!refund) {
      throw new AppError("Refund record not found", 404, "REFUND_NOT_FOUND");
    }

    return apiResponse.sendSuccess(res, {
      message: "Refund details retrieved successfully",
      data: {
        id: refund._id,
        amount: refund.amount ? parseFloat(refund.amount.toString()) : 0,
        currency: refund.currency,
        status: refund.status,
        gateway: refund.gateway,
        gatewayRefundId: refund.gatewayRefundId,
        reason: refund.reason,
        createdAt: refund.createdAt,
        order: refund.orderId,
        payment: refund.paymentId,
        customer: refund.customerId?.userId || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRefund,
  listRefunds,
  getRefundById,
};