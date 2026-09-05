const PAYMENT_GATEWAYS = Object.freeze({
  RAZORPAY: "razorpay",
});

const PAYMENT_STATUSES = Object.freeze({
  CREATED: "created",
  PENDING: "pending",
  AUTHORIZED: "authorized",
  CAPTURED: "captured",
  FAILED: "failed",
  CANCELLED: "cancelled",
  PARTIALLY_REFUNDED: "partially_refunded",
  REFUNDED: "refunded",
});

const PAYMENT_METHODS = Object.freeze([
  "card",
  "netbanking",
  "upi",
  "wallet",
  "emi",
  "bank_transfer",
  "other",
]);

const PAYMENT_STATUS_TRANSITIONS = Object.freeze({
  created: ["pending", "authorized", "captured", "failed", "cancelled"],
  pending: ["authorized", "captured", "failed", "cancelled"],
  authorized: ["captured", "failed", "cancelled"],
  captured: ["partially_refunded", "refunded"],
  failed: [],
  cancelled: [],
  partially_refunded: ["partially_refunded", "refunded"],
  refunded: [],
});

const canTransitionPaymentStatus = (
  currentStatus,
  nextStatus
) => {
  const allowedTransitions =
    PAYMENT_STATUS_TRANSITIONS[currentStatus] || [];

  return allowedTransitions.includes(nextStatus);
};

module.exports = {
  PAYMENT_GATEWAYS,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUS_TRANSITIONS,
  canTransitionPaymentStatus,
};