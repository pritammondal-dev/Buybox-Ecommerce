const FINANCIAL_ENTRY_TYPES = Object.freeze({
  PAYMENT_RECEIVED: "payment_received",
  ORDER_SALE: "order_sale",
  PLATFORM_COMMISSION: "platform_commission",
  VENDOR_EARNING: "vendor_earning",
  REFUND: "refund",
  PAYOUT: "payout",
  ADJUSTMENT: "adjustment",
  REVERSAL: "reversal",
  PROMOTION_SUBSIDY: "promotion_subsidy",
  SUBSIDY_REVERSAL: "subsidy_reversal",
  SETTLEMENT_MATURED: "settlement_matured",
  PAYOUT_RESERVED: "payout_reserved",
  PAYOUT_RELEASED: "payout_released",
  PAYOUT_PAID: "payout_paid",
  COMMISSION_REVERSAL: "commission_reversal",
  REFUND_REVERSAL: "refund_reversal",
  WITHDRAWAL_RESERVED: "withdrawal_reserved",
  WITHDRAWAL_RELEASED: "withdrawal_released",
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

const LEDGER_ACCOUNTS = Object.freeze({
  // Asset Accounts (Debits increase asset, Credits decrease asset)
  PLATFORM_ESCROW: "platform_escrow",
  PAYOUT_CLEARING: "payout_clearing",

  // Liability Accounts (Credits increase liability, Debits decrease liability)
  CUSTOMER_PAYMENT_CLEARING: "customer_payment_clearing",
  VENDOR_PENDING_EARNINGS: "vendor_pending_earnings",
  VENDOR_AVAILABLE_EARNINGS: "vendor_available_earnings",
  VENDOR_RESERVED_PAYOUT: "vendor_reserved_payout",
  REFUND_CLEARING: "refund_clearing",

  // Equity / Revenue / Expense Accounts
  PLATFORM_COMMISSION_REVENUE: "platform_commission_revenue",
  COMMISSION_REVERSAL: "commission_reversal",
  PLATFORM_SUBSIDY_EXPENSE: "platform_subsidy_expense",
  FINANCIAL_ADJUSTMENT: "financial_adjustment",
});

const JOURNAL_STATUSES = Object.freeze({
  POSTED: "posted",
  REVERSED: "reversed",
});

const WALLET_STATUSES = Object.freeze({
  ACTIVE: "active",
  FROZEN: "frozen",
  SUSPENDED: "suspended",
  CLOSED: "closed",
});

const WITHDRAWAL_STATUSES = Object.freeze({
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  PROCESSING: "processing",
  COMPLETED: "completed",
  REJECTED: "rejected",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

const COMMISSION_POLICY_SCOPES = Object.freeze({
  GLOBAL: "global",
  CATEGORY: "category",
  VENDOR: "vendor",
  PRODUCT: "product",
});

const COMMISSION_SOURCES = Object.freeze({
  PRODUCT: "product",
  VENDOR: "vendor",
  VENDOR_PROFILE: "vendor_profile",
  CATEGORY: "category",
  GLOBAL: "global",
  LEGACY_FALLBACK: "legacy_fallback",
});

const EXCEPTION_CATEGORIES = Object.freeze({
  LEGACY_PRE_DOUBLE_ENTRY_TEST_ARTIFACT: "LEGACY_PRE_DOUBLE_ENTRY_TEST_ARTIFACT",
  MALFORMED_ENTRY: "MALFORMED_ENTRY",
  UNBALANCED_JOURNAL: "UNBALANCED_JOURNAL",
  MISSING_COUNTERPART: "MISSING_COUNTERPART",
  UNCLASSIFIED_PRE_ENGINE: "UNCLASSIFIED_PRE_ENGINE",
});

const EXCEPTION_STATUSES = Object.freeze({
  CLASSIFIED: "classified",
  PENDING_REVIEW: "pending_review",
  RESOLVED_EXCLUDED: "resolved_excluded",
});

module.exports = {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
  FINANCIAL_ENTRY_SOURCES,
  LEDGER_ACCOUNTS,
  JOURNAL_STATUSES,
  WALLET_STATUSES,
  WITHDRAWAL_STATUSES,
  COMMISSION_POLICY_SCOPES,
  COMMISSION_SOURCES,
  EXCEPTION_CATEGORIES,
  EXCEPTION_STATUSES,
};
