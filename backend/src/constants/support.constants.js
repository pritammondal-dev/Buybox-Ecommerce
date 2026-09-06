const SUPPORT_TICKET_STATUSES = Object.freeze({
  OPEN: "open",
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
});

const SUPPORT_TICKET_PRIORITIES = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
});

const SUPPORT_TICKET_CATEGORIES = Object.freeze({
  ORDER: "order",
  PAYMENT: "payment",
  SHIPPING: "shipping",
  PRODUCT: "product",
  REFUND: "refund",
  ACCOUNT: "account",
  TECHNICAL: "technical",
  OTHER: "other",
});

const SUPPORT_TICKET_STATUS_TRANSITIONS = Object.freeze({
  open: ["pending", "in_progress", "resolved", "closed"],
  pending: ["open", "in_progress", "resolved", "closed"],
  in_progress: ["pending", "resolved", "closed"],
  resolved: ["closed", "open"],
  closed: ["open"],
});

module.exports = {
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUS_TRANSITIONS,
};