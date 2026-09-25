const mongoose = require("mongoose");
const RewardAccount = require("../models/RewardAccount");
const RewardTransaction = require("../models/RewardTransaction");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const AppError = require("../errors/AppError");

const POINTS_PER_CURRENCY_UNIT = 1 / 100; // 1 point per 100 INR

const calculateTier = (totalEarned) => {
  if (totalEarned >= 5000) return "platinum";
  if (totalEarned >= 1500) return "gold";
  if (totalEarned >= 500) return "silver";
  return "bronze";
};

/**
 * Accrue reward points for a paid and delivered order.
 * Strictly idempotent: prevents duplicate accruals for the same order.
 */
const accruePointsForDeliveredOrder = async (orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId) || mongoose.connection.readyState === 0) {
    return null;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return null;
  }

  // Only eligible if paid and delivered/completed
  const isEligible =
    (order.status === "delivered" || order.status === "completed") &&
    order.paymentStatus === "paid";

  if (!isEligible) {
    return null;
  }

  // Idempotency check: verify if points have already been awarded for this order
  const existingEarned = await RewardTransaction.findOne({
    orderId: order._id,
    type: "earned",
  });

  if (existingEarned) {
    return existingEarned;
  }

  const grandTotalNum = Number(order.grandTotal?.toString() || order.grandTotal || 0);
  const pointsToAward = Math.floor(grandTotalNum * POINTS_PER_CURRENCY_UNIT);

  if (pointsToAward <= 0) {
    return null;
  }

  let account = await RewardAccount.findOne({ customerId: order.customerId });
  if (!account) {
    const customer = await Customer.findById(order.customerId);
    account = await RewardAccount.create({
      customerId: order.customerId,
      userId: customer?.userId || order.customerId,
      pointsBalance: 0,
      pointsEarnedTotal: 0,
      tier: "bronze",
    });
  }

  // Create append-only reward ledger transaction
  const transaction = await RewardTransaction.create({
    rewardAccountId: account._id,
    customerId: order.customerId,
    type: "earned",
    points: pointsToAward,
    orderId: order._id,
    description: `Points earned for Order #${order.orderNumber || order._id}`,
  });

  account.pointsBalance = (account.pointsBalance || 0) + pointsToAward;
  account.pointsEarnedTotal = (account.pointsEarnedTotal || 0) + pointsToAward;
  account.tier = calculateTier(account.pointsEarnedTotal);
  await account.save();

  return transaction;
};

/**
 * Adjust/debit reward points when an order is cancelled or refunded.
 * Ensures the ledger remains append-only and balance does not drop below zero.
 */
const adjustPointsForCancelledOrRefundedOrder = async (orderId, refundedAmount = null) => {
  if (!mongoose.Types.ObjectId.isValid(orderId) || mongoose.connection.readyState === 0) {
    return null;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return null;
  }

  const account = await RewardAccount.findOne({ customerId: order.customerId });
  if (!account) {
    return null;
  }

  // Find all earned points for this order
  const earnedTransactions = await RewardTransaction.find({
    orderId: order._id,
    type: "earned",
  });

  if (earnedTransactions.length === 0) {
    return null;
  }

  const totalEarnedForOrder = earnedTransactions.reduce((sum, t) => sum + (t.points || 0), 0);

  let pointsToDebit = totalEarnedForOrder;
  if (refundedAmount !== null && refundedAmount !== undefined) {
    const refundNum = Number(refundedAmount.toString() || 0);
    pointsToDebit = Math.min(
      totalEarnedForOrder,
      Math.floor(refundNum * POINTS_PER_CURRENCY_UNIT)
    );
  }

  if (pointsToDebit <= 0) {
    return null;
  }

  // Check if an adjustment has already been recorded for this exact refund
  const existingAdjustments = await RewardTransaction.find({
    orderId: order._id,
    type: "adjusted",
  });

  const totalAdjusted = existingAdjustments.reduce((sum, t) => sum + Math.abs(t.points || 0), 0);
  if (totalAdjusted >= totalEarnedForOrder) {
    return null; // Already fully adjusted
  }

  const actualDebit = Math.min(pointsToDebit, totalEarnedForOrder - totalAdjusted);
  if (actualDebit <= 0) {
    return null;
  }

  const transaction = await RewardTransaction.create({
    rewardAccountId: account._id,
    customerId: order.customerId,
    type: "adjusted",
    points: -actualDebit,
    orderId: order._id,
    description: `Points reversed for Order #${order.orderNumber || order._id} (cancellation/refund)`,
  });

  account.pointsBalance = Math.max(0, (account.pointsBalance || 0) - actualDebit);
  await account.save();

  return transaction;
};

module.exports = {
  accruePointsForDeliveredOrder,
  adjustPointsForCancelledOrRefundedOrder,
  calculateTier,
  POINTS_PER_CURRENCY_UNIT,
};
