const PERMISSIONS = Object.freeze({
  PRODUCTS_READ: "products:read",
  PRODUCTS_CREATE: "products:create",
  PRODUCTS_UPDATE: "products:update",
  PRODUCTS_DELETE: "products:delete",

  INVENTORY_READ: "inventory:read",
  INVENTORY_MANAGE: "inventory:manage",

  ORDERS_READ: "orders:read",
  ORDERS_MANAGE: "orders:manage",

  USERS_READ: "users:read",
  USERS_MANAGE: "users:manage",

  VENDORS_READ: "vendors:read",
  VENDORS_MANAGE: "vendors:manage",

  PAYMENTS_READ: "payments:read",
  PAYMENTS_MANAGE: "payments:manage",

  REPORTS_READ: "reports:read",

  SETTINGS_READ: "settings:read",
  SETTINGS_MANAGE: "settings:manage",
});

module.exports = {
  PERMISSIONS,
};