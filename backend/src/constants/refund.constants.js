const REFUND_STATUSES = Object.freeze({
  CREATED: "created",
  PENDING: "pending",
  PROCESSED: "processed",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

const REFUND_STATUS_TRANSITIONS = Object.freeze({
  created: ["pending", "processed", "failed", "cancelled"],
  pending: ["processed", "failed", "cancelled"],
  processed: [],
  failed: ["created", "pending"],
  cancelled: [],
});

const canTransitionRefundStatus = (
  currentStatus,
  nextStatus
) => {
  const allowedTransitions =
    REFUND_STATUS_TRANSITIONS[currentStatus] || [];

  return allowedTransitions.includes(nextStatus);
};

module.exports = {
  REFUND_STATUSES,
  REFUND_STATUS_TRANSITIONS,
  canTransitionRefundStatus,
};