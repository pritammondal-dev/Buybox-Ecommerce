const DISCOUNT_TYPES = {
  PERCENTAGE: "percentage",
  FIXED_AMOUNT: "fixed_amount",
};

const DISCOUNT_STATUSES = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  ACTIVE: "active",
  PAUSED: "paused",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

const DISCOUNT_SCOPES = {
  ALL: "all",
  PRODUCTS: "products",
  VARIANTS: "variants",
  CATEGORIES: "categories",
  BRANDS: "brands",
};

const FUNDING_SOURCES = {
  PLATFORM: "platform",
  VENDOR: "vendor",
};

module.exports = {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
  FUNDING_SOURCES,
};
