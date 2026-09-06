const FINANCIAL_ENTRY_TYPES = Object.freeze({
  PAYMENT_RECEIVED: "payment_received",
  ORDER_SALE: "order_sale",
  PLATFORM_COMMISSION: "platform_commission",
  VENDOR_EARNING: "vendor_earning",
  REFUND: "refund",
  PAYOUT: "payout",
  ADJUSTMENT: "adjustment",
  REVERSAL: "reversal",
});

const FINANCIAL_ENTRY_DIRECTIONS = Object.freeze({
  DEBIT: "debit",
  CREDIT: "credit",
});

const FINANCIAL_ACCOUNT_TYPES = Object.freeze({
  PLATFORM: "platform",
  VENDOR: "vendor",
  CUSTOMER: "customer",
  PAYMENT_GATEWAY: "payment_gateway",
  CLEARING: "clearing",
});

const FINANCIAL_ENTRY_SOURCES = Object.freeze({
  SYSTEM: "system",
  ADMIN: "admin",
  WEBHOOK: "webhook",
  JOB: "job",
});

module.exports = {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
  FINANCIAL_ENTRY_SOURCES,
};