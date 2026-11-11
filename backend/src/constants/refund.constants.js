const REFUND_STATUSES = Object.freeze({
  CREATED: "created",
  PENDING: "pending",
  PROCESSED: "processed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REVERSED: "reversed",
});

const REFUND_STATUS_TRANSITIONS = Object.freeze({
  created: ["pending", "processed", "failed", "cancelled"],
  pending: ["processed", "failed", "cancelled", "reversed"],
  processed: ["reversed"],
  failed: ["created", "pending"],
  cancelled: [],
  reversed: [],
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