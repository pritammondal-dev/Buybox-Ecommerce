const PERMISSIONS = Object.freeze({
  PRODUCTS_READ: "products:read",
  PRODUCTS_CREATE: "products:create",
  PRODUCTS_UPDATE: "products:update",
  PRODUCTS_DELETE: "products:delete",

  INVENTORY_READ: "inventory:read",
  INVENTORY_MANAGE: "inventory:manage",

  WAREHOUSES_READ: "warehouses:read",
  WAREHOUSES_MANAGE: "warehouses:manage",

  SHIPMENTS_READ: "shipments:read",
  SHIPMENTS_MANAGE: "shipments:manage",

  SHIPMENTS_READ_OWN: "shipments:read_own",
  SHIPMENTS_MANAGE_OWN: "shipments:manage_own",

  ORDERS_READ: "orders:read",
  ORDERS_MANAGE: "orders:manage",

  USERS_READ: "users:read",
  USERS_MANAGE: "users:manage",

  VENDORS_READ: "vendors:read",
  VENDORS_MANAGE: "vendors:manage",

  PAYMENTS_READ: "payments:read",
  PAYMENTS_MANAGE: "payments:manage",

  FINANCE_READ: "finance:read",
  FINANCE_MANAGE: "finance:manage",

  REPORTS_READ: "reports:read",

  SETTINGS_READ: "settings:read",
  SETTINGS_MANAGE: "settings:manage",

  COUPONS_READ: "coupons:read",
  COUPONS_MANAGE: "coupons:manage",

  CAMPAIGNS_READ: "campaigns:read",
  CAMPAIGNS_MANAGE: "campaigns:manage",

  REVIEWS_READ: "reviews:read",
  REVIEWS_MANAGE: "reviews:manage",

  SUPPORT_TICKETS_READ: "support_tickets:read",
  SUPPORT_TICKETS_MANAGE: "support_tickets:manage",

  TAX_READ: "tax:read",
  TAX_MANAGE: "tax:manage",

  ANALYTICS_READ: "analytics:read",
  ANALYTICS_READ_OWN: "analytics:read_own",
});

module.exports = {
  PERMISSIONS,
};