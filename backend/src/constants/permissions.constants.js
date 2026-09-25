const PERMISSIONS = Object.freeze({
  // Legacy / Existing Colon-Delimited Permissions
  PRODUCTS_READ: "products:read",
  PRODUCTS_CREATE: "products:create",
  PRODUCTS_UPDATE: "products:update",
  PRODUCTS_DELETE: "products:delete",
  PRODUCTS_MODERATE: "products:moderate",

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
  ORDERS_READ_OWN: "orders:read_own",

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
  REVIEWS_MODERATE: "reviews:moderate",

  SUPPORT_TICKETS_READ: "support_tickets:read",
  SUPPORT_TICKETS_MANAGE: "support_tickets:manage",

  TAX_READ: "tax:read",
  TAX_MANAGE: "tax:manage",

  ANALYTICS_READ: "analytics:read",
  ANALYTICS_READ_OWN: "analytics:read_own",

  ROLES_READ: "roles:read",
  ROLES_MANAGE: "roles:manage",

  PERMISSIONS_READ: "permissions:read",
  PERMISSIONS_MANAGE: "permissions:manage",

  EMPLOYEES_READ: "employees:read",
  EMPLOYEES_MANAGE: "employees:manage",

  WORK_ASSIGNMENTS_READ: "work_assignments:read",
  WORK_ASSIGNMENTS_MANAGE: "work_assignments:manage",

  AUDIT_LOGS_READ: "audit_logs:read",

  // Section 5 Granular Namespaced Permissions
  DASHBOARD_VIEW: "dashboard.view",

  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_EDIT: "customers.edit",
  CUSTOMERS_SUSPEND: "customers.suspend",
  CUSTOMERS_EXPORT: "customers.export",

  VENDORS_VIEW: "vendors.view",
  VENDORS_APPROVE: "vendors.approve",
  VENDORS_REJECT: "vendors.reject",
  VENDORS_REQUEST_CHANGES: "vendors.request_changes",
  VENDORS_SUSPEND: "vendors.suspend",
  VENDORS_EDIT: "vendors.edit",
  VENDORS_EXPORT: "vendors.export",

  PRODUCTS_VIEW: "products.view",
  PRODUCTS_CREATE_SEC5: "products.create",
  PRODUCTS_EDIT: "products.edit",
  PRODUCTS_DELETE_SEC5: "products.delete",
  PRODUCTS_APPROVE: "products.approve",
  PRODUCTS_REJECT: "products.reject",
  PRODUCTS_EXPORT: "products.export",

  CATEGORIES_VIEW: "categories.view",
  CATEGORIES_CREATE: "categories.create",
  CATEGORIES_EDIT: "categories.edit",
  CATEGORIES_DELETE: "categories.delete",

  BRANDS_VIEW: "brands.view",
  BRANDS_CREATE: "brands.create",
  BRANDS_EDIT: "brands.edit",
  BRANDS_DELETE: "brands.delete",

  INVENTORY_VIEW: "inventory.view",
  INVENTORY_ADJUST: "inventory.adjust",
  INVENTORY_TRANSFER: "inventory.transfer",

  WAREHOUSES_VIEW: "warehouses.view",
  WAREHOUSES_CREATE: "warehouses.create",
  WAREHOUSES_EDIT: "warehouses.edit",
  WAREHOUSES_MANAGE_INVENTORY: "warehouses.manage_inventory",

  ORDERS_VIEW: "orders.view",
  ORDERS_EDIT: "orders.edit",
  ORDERS_CANCEL: "orders.cancel",

  RETURNS_VIEW: "returns.view",
  RETURNS_APPROVE: "returns.approve",
  RETURNS_REJECT: "returns.reject",

  REFUNDS_VIEW: "refunds.view",
  REFUNDS_CREATE: "refunds.create",
  REFUNDS_APPROVE: "refunds.approve",

  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_RECONCILE: "payments.reconcile",

  SETTLEMENTS_VIEW: "settlements.view",
  SETTLEMENTS_MANAGE: "settlements.manage",

  SHIPPING_VIEW: "shipping.view",
  SHIPPING_MANAGE: "shipping.manage",

  CAMPAIGNS_VIEW: "campaigns.view",
  CAMPAIGNS_CREATE: "campaigns.create",
  CAMPAIGNS_EDIT: "campaigns.edit",
  CAMPAIGNS_DELETE: "campaigns.delete",

  COUPONS_VIEW: "coupons.view",
  COUPONS_CREATE: "coupons.create",
  COUPONS_EDIT: "coupons.edit",
  COUPONS_DELETE: "coupons.delete",

  CMS_VIEW: "cms.view",
  CMS_CREATE: "cms.create",
  CMS_EDIT: "cms.edit",
  CMS_PUBLISH: "cms.publish",

  REVIEWS_VIEW: "reviews.view",
  REVIEWS_MODERATE_SEC5: "reviews.moderate",

  SUPPORT_VIEW: "support.view",
  SUPPORT_RESPOND: "support.respond",
  SUPPORT_ASSIGN: "support.assign",

  ANALYTICS_VIEW: "analytics.view",
  ANALYTICS_EXPORT: "analytics.export",

  TASKS_VIEW: "tasks.view",
  TASKS_CREATE: "tasks.create",
  TASKS_ASSIGN: "tasks.assign",
  TASKS_EDIT: "tasks.edit",
  TASKS_COMPLETE: "tasks.complete",

  ACTIVITY_LOGS_VIEW: "activity_logs.view",
  ACTIVITY_LOGS_EXPORT: "activity_logs.export",

  STAFF_VIEW: "staff.view",
  STAFF_CREATE: "staff.create",
  STAFF_EDIT: "staff.edit",
  STAFF_SUSPEND: "staff.suspend",

  PERMISSIONS_VIEW_SEC5: "permissions.view",
  PERMISSIONS_MANAGE_SEC5: "permissions.manage",

  PLATFORM_SETTINGS_VIEW: "platform_settings.view",
  PLATFORM_SETTINGS_MANAGE: "platform_settings.manage",

  PLATFORM_CREDENTIALS_VIEW: "platform_credentials.view",
  PLATFORM_CREDENTIALS_MANAGE: "platform_credentials.manage",

  AUTHENTICATION_LOGIN_METHODS_READ: "authentication.login_methods.read",
  AUTHENTICATION_LOGIN_METHODS_MANAGE: "authentication.login_methods.manage",

  // Dynamic Job Roles & Staff Role Assignment Permissions
  JOB_ROLES_VIEW: "job_roles.view",
  JOB_ROLES_CREATE: "job_roles.create",
  JOB_ROLES_EDIT: "job_roles.edit",
  JOB_ROLES_DELETE: "job_roles.delete",
  JOB_ROLES_REORDER: "job_roles.reorder",
  JOB_ROLES_MIGRATE: "job_roles.migrate",

  EMPLOYEE_ASSIGN_ROLE: "employee.assign_role",
  EMPLOYEE_VIEW: "employee.view",
  EMPLOYEE_CREATE: "employee.create",
  EMPLOYEE_EDIT: "employee.edit",
  EMPLOYEE_DELETE: "employee.delete",

  SUPERADMIN_TRANSFER: "governance.superadmin_transfer",
});

/**
 * Bi-directional alias mappings between legacy colon format and Section 5 dot format.
 */
const ALIAS_MAP = {
  // Dot -> Colon
  "dashboard.view": ["analytics:read"],
  "customers.view": ["users:read"],
  "customers.create": ["users:manage"],
  "customers.edit": ["users:manage"],
  "customers.suspend": ["users:manage"],
  "customers.export": ["users:read"],
  "vendors.view": ["vendors:read"],
  "vendors.approve": ["vendors:manage"],
  "vendors.reject": ["vendors:manage"],
  "vendors.request_changes": ["vendors:manage"],
  "vendors.suspend": ["vendors:manage"],
  "vendors.edit": ["vendors:manage"],
  "vendors.export": ["vendors:read"],
  "products.view": ["products:read"],
  "products.create": ["products:create"],
  "products.edit": ["products:update"],
  "products.delete": ["products:delete"],
  "products.approve": ["products:moderate"],
  "products.reject": ["products:moderate"],
  "products.export": ["products:read"],
  "categories.view": ["products:read"],
  "categories.create": ["products:create"],
  "categories.edit": ["products:update"],
  "categories.delete": ["products:delete"],
  "brands.view": ["products:read"],
  "brands.create": ["products:create"],
  "brands.edit": ["products:update"],
  "brands.delete": ["products:delete"],
  "inventory.view": ["inventory:read"],
  "inventory.adjust": ["inventory:manage"],
  "inventory.transfer": ["inventory:manage"],
  "warehouses.view": ["warehouses:read"],
  "warehouses.create": ["warehouses:manage"],
  "warehouses.edit": ["warehouses:manage"],
  "warehouses.manage_inventory": ["warehouses:manage"],
  "orders.view": ["orders:read"],
  "orders.edit": ["orders:manage"],
  "orders.cancel": ["orders:manage"],
  "returns.view": ["orders:read"],
  "returns.approve": ["orders:manage"],
  "returns.reject": ["orders:manage"],
  "refunds.view": ["finance:read"],
  "refunds.create": ["finance:manage"],
  "refunds.approve": ["finance:manage"],
  "payments.view": ["payments:read"],
  "payments.reconcile": ["payments:manage"],
  "settlements.view": ["finance:read"],
  "settlements.manage": ["finance:manage"],
  "shipping.view": ["shipments:read"],
  "shipping.manage": ["shipments:manage"],
  "campaigns.view": ["campaigns:read"],
  "campaigns.create": ["campaigns:manage"],
  "campaigns.edit": ["campaigns:manage"],
  "campaigns.delete": ["campaigns:manage"],
  "coupons.view": ["coupons:read"],
  "coupons.create": ["coupons:manage"],
  "coupons.edit": ["coupons:manage"],
  "coupons.delete": ["coupons:manage"],
  "cms.view": ["settings:read"],
  "cms.create": ["settings:manage"],
  "cms.edit": ["settings:manage"],
  "cms.publish": ["settings:manage"],
  "reviews.view": ["reviews:read"],
  "reviews.moderate": ["reviews:moderate", "reviews:manage"],
  "support.view": ["support_tickets:read"],
  "support.respond": ["support_tickets:manage"],
  "support.assign": ["support_tickets:manage"],
  "analytics.view": ["analytics:read"],
  "analytics.export": ["analytics:read"],
  "tasks.view": ["work_assignments:read"],
  "tasks.create": ["work_assignments:manage"],
  "tasks.assign": ["work_assignments:manage"],
  "tasks.edit": ["work_assignments:manage"],
  "tasks.complete": ["work_assignments:manage"],
  "activity_logs.view": ["audit_logs:read"],
  "activity_logs.export": ["audit_logs:read"],
  "staff.view": ["employees:read"],
  "staff.create": ["employees:manage"],
  "staff.edit": ["employees:manage"],
  "staff.suspend": ["employees:manage"],
  "permissions.view": ["permissions:read"],
  "permissions.manage": ["permissions:manage"],
  "platform_settings.view": ["settings:read"],
  "platform_settings.manage": ["settings:manage"],
  "platform_credentials.view": ["settings:read"],
  "platform_credentials.manage": ["settings:manage"],
  "authentication.login_methods.read": ["settings:read", "platform_settings.view"],
  "authentication.login_methods.manage": ["settings:manage", "platform_settings.manage"],

  "job_roles.view": ["roles:read", "permissions:read", "permissions.view"],
  "job_roles.create": ["roles:manage", "permissions:manage", "permissions.manage"],
  "job_roles.edit": ["roles:manage", "permissions:manage", "permissions.manage"],
  "job_roles.delete": ["roles:manage"],
  "job_roles.reorder": ["roles:manage"],
  "job_roles.migrate": ["roles:manage"],

  "employee.view": ["staff.view", "employees:read"],
  "employee.create": ["staff.create", "employees:manage"],
  "employee.edit": ["staff.edit", "employees:manage"],
  "employee.delete": ["staff.suspend", "employees:manage"],
  "employee.assign_role": ["staff.create", "staff.edit", "roles:manage"],
  "staff.assign_role": ["employee.assign_role", "roles:manage", "staff.create", "staff.edit"],
  "governance.superadmin_transfer": ["roles:manage"],

  // Colon -> Dot
  "audit_logs:read": ["activity_logs.view", "activity_logs.export"],
  "products:read": ["products.view", "categories.view", "brands.view"],
  "products:create": ["products.create", "categories.create", "brands.create"],
  "products:update": ["products.edit", "categories.edit", "brands.edit"],
  "products:delete": ["products.delete", "categories.delete", "brands.delete"],
  "products:moderate": ["products.approve", "products.reject"],
  "inventory:read": ["inventory.view"],
  "inventory:manage": ["inventory.adjust", "inventory.transfer"],
  "warehouses:read": ["warehouses.view"],
  "warehouses:manage": [
    "warehouses.create",
    "warehouses.edit",
    "warehouses.manage_inventory",
  ],
  "shipments:read": ["shipping.view"],
  "shipments:manage": ["shipping.manage"],
  "orders:read": ["orders.view", "returns.view"],
  "orders:manage": [
    "orders.edit",
    "orders.cancel",
    "returns.approve",
    "returns.reject",
  ],
  "users:read": ["customers.view", "customers.export"],
  "users:manage": [
    "customers.create",
    "customers.edit",
    "customers.suspend",
  ],
  "vendors:read": ["vendors.view", "vendors.export"],
  "vendors:manage": [
    "vendors.approve",
    "vendors.reject",
    "vendors.request_changes",
    "vendors.suspend",
    "vendors.edit",
  ],
  "payments:read": ["payments.view"],
  "payments:manage": ["payments.reconcile"],
  "finance:read": ["settlements.view", "refunds.view"],
  "finance:manage": [
    "settlements.manage",
    "refunds.create",
    "refunds.approve",
  ],
  "settings:read": [
    "platform_settings.view",
    "platform_credentials.view",
    "authentication.login_methods.read",
    "cms.view",
  ],
  "settings:manage": [
    "platform_settings.manage",
    "platform_credentials.manage",
    "authentication.login_methods.manage",
    "cms.create",
    "cms.edit",
    "cms.publish",
  ],
  "coupons:read": ["coupons.view"],
  "coupons:manage": ["coupons.create", "coupons.edit", "coupons.delete"],
  "campaigns:read": ["campaigns.view"],
  "campaigns:manage": [
    "campaigns.create",
    "campaigns.edit",
    "campaigns.delete",
  ],
  "reviews:read": ["reviews.view"],
  "reviews:manage": ["reviews.moderate"],
  "reviews:moderate": ["reviews.moderate"],
  "support_tickets:read": ["support.view"],
  "support_tickets:manage": ["support.respond", "support.assign"],
  "analytics:read": ["analytics.view", "analytics.export", "dashboard.view"],
  "employees:read": ["staff.view", "employee.view"],
  "employees:manage": [
    "staff.create",
    "staff.edit",
    "staff.suspend",
    "employee.create",
    "employee.edit",
    "employee.delete",
    "employee.assign_role",
  ],
  "roles:read": ["job_roles.view"],
  "roles:manage": [
    "job_roles.create",
    "job_roles.edit",
    "job_roles.delete",
    "job_roles.reorder",
    "job_roles.migrate",
    "employee.assign_role",
    "governance.superadmin_transfer",
  ],
  "permissions:read": ["permissions.view", "job_roles.view"],
  "permissions:manage": ["permissions.manage", "job_roles.edit"],
  "work_assignments:read": ["tasks.view"],
  "work_assignments:manage": [
    "tasks.create",
    "tasks.assign",
    "tasks.edit",
    "tasks.complete",
  ],
};

/**
 * Given a required permission, return all valid forms that satisfy it.
 *
 * @param {string} permission
 * @returns {string[]}
 */
const resolvePermissionAliases = (permission) => {
  if (!permission || typeof permission !== "string") return [];
  const aliases = ALIAS_MAP[permission] || [];
  return [permission, ...aliases];
};

/**
 * Granular Section 5 Permission Catalog for UI and DB seeding.
 */
const SECTION5_CATALOG = Object.freeze([
  {
    category: "Dashboard",
    permissions: [
      { slug: "dashboard.view", name: "View Dashboard", description: "Access real-time platform metrics and KPIs" },
    ],
  },
  {
    category: "Customers",
    permissions: [
      { slug: "customers.view", name: "View Customers", description: "View customer profiles, orders, and details" },
      { slug: "customers.create", name: "Create Customers", description: "Manually register or create customer records" },
      { slug: "customers.edit", name: "Edit Customers", description: "Update customer profile and account details" },
      { slug: "customers.suspend", name: "Suspend Customers", description: "Deactivate or suspend customer accounts" },
      { slug: "customers.export", name: "Export Customers", description: "Export customer datasets" },
    ],
  },
  {
    category: "Vendors",
    permissions: [
      { slug: "vendors.view", name: "View Vendors", description: "View vendor accounts and onboarding queue" },
      { slug: "vendors.approve", name: "Approve Vendors", description: "Approve pending vendor onboarding applications" },
      { slug: "vendors.reject", name: "Reject Vendors", description: "Reject vendor onboarding applications" },
      { slug: "vendors.request_changes", name: "Request Changes", description: "Request onboarding corrections from vendor" },
      { slug: "vendors.suspend", name: "Suspend Vendors", description: "Suspend or ban active vendors" },
      { slug: "vendors.edit", name: "Edit Vendors", description: "Update vendor profile, commission, or settings" },
      { slug: "vendors.export", name: "Export Vendors", description: "Export vendor lists and data" },
    ],
  },
  {
    category: "Products",
    permissions: [
      { slug: "products.view", name: "View Products", description: "Browse catalog and products" },
      { slug: "products.create", name: "Create Products", description: "Create new product listings" },
      { slug: "products.edit", name: "Edit Products", description: "Modify product pricing, descriptions, and variants" },
      { slug: "products.delete", name: "Delete Products", description: "Remove product listings" },
      { slug: "products.approve", name: "Approve Products", description: "Approve submitted vendor products" },
      { slug: "products.reject", name: "Reject Products", description: "Reject submitted vendor products" },
      { slug: "products.export", name: "Export Products", description: "Export catalog datasets" },
    ],
  },
  {
    category: "Categories",
    permissions: [
      { slug: "categories.view", name: "View Categories", description: "View category hierarchy" },
      { slug: "categories.create", name: "Create Categories", description: "Create category nodes" },
      { slug: "categories.edit", name: "Edit Categories", description: "Update categories" },
      { slug: "categories.delete", name: "Delete Categories", description: "Delete categories" },
    ],
  },
  {
    category: "Brands",
    permissions: [
      { slug: "brands.view", name: "View Brands", description: "View brand list" },
      { slug: "brands.create", name: "Create Brands", description: "Add new brands" },
      { slug: "brands.edit", name: "Edit Brands", description: "Update brand details" },
      { slug: "brands.delete", name: "Delete Brands", description: "Remove brands" },
    ],
  },
  {
    category: "Inventory",
    permissions: [
      { slug: "inventory.view", name: "View Inventory", description: "Inspect inventory levels across warehouses" },
      { slug: "inventory.adjust", name: "Adjust Stock", description: "Perform manual stock adjustments" },
      { slug: "inventory.transfer", name: "Transfer Stock", description: "Initiate warehouse stock transfers" },
    ],
  },
  {
    category: "Warehouses",
    permissions: [
      { slug: "warehouses.view", name: "View Warehouses", description: "View warehouse locations" },
      { slug: "warehouses.create", name: "Create Warehouses", description: "Add new warehouse facilities" },
      { slug: "warehouses.edit", name: "Edit Warehouses", description: "Update warehouse details and zones" },
      { slug: "warehouses.manage_inventory", name: "Manage Inventory", description: "Manage warehouse stock allocations" },
    ],
  },
  {
    category: "Orders",
    permissions: [
      { slug: "orders.view", name: "View Orders", description: "View order queue and customer order details" },
      { slug: "orders.edit", name: "Edit Orders", description: "Update order delivery details and notes" },
      { slug: "orders.cancel", name: "Cancel Orders", description: "Cancel unfulfilled orders" },
    ],
  },
  {
    category: "Returns",
    permissions: [
      { slug: "returns.view", name: "View Returns", description: "View return requests queue" },
      { slug: "returns.approve", name: "Approve Returns", description: "Authorize return requests" },
      { slug: "returns.reject", name: "Reject Returns", description: "Decline return requests" },
    ],
  },
  {
    category: "Refunds",
    permissions: [
      { slug: "refunds.view", name: "View Refunds", description: "View financial refund records" },
      { slug: "refunds.create", name: "Create Refunds", description: "Initiate refund requests" },
      { slug: "refunds.approve", name: "Approve Refunds", description: "Authorize payment gateway refunds" },
    ],
  },
  {
    category: "Payments",
    permissions: [
      { slug: "payments.view", name: "View Payments", description: "View gateway payments and transactions" },
      { slug: "payments.reconcile", name: "Reconcile Payments", description: "Perform payment reconciliation" },
    ],
  },
  {
    category: "Settlements",
    permissions: [
      { slug: "settlements.view", name: "View Settlements", description: "View vendor settlement periods and balances" },
      { slug: "settlements.manage", name: "Manage Settlements", description: "Approve payouts and finalize settlements" },
    ],
  },
  {
    category: "Shipping",
    permissions: [
      { slug: "shipping.view", name: "View Shipping", description: "View shipments and tracking" },
      { slug: "shipping.manage", name: "Manage Shipping", description: "Dispatch, reassign, or configure couriers" },
    ],
  },
  {
    category: "Campaigns",
    permissions: [
      { slug: "campaigns.view", name: "View Campaigns", description: "View marketing campaigns" },
      { slug: "campaigns.create", name: "Create Campaigns", description: "Create promotional campaigns" },
      { slug: "campaigns.edit", name: "Edit Campaigns", description: "Update active campaigns" },
      { slug: "campaigns.delete", name: "Delete Campaigns", description: "Remove campaigns" },
    ],
  },
  {
    category: "Coupons",
    permissions: [
      { slug: "coupons.view", name: "View Coupons", description: "View coupon codes and usage" },
      { slug: "coupons.create", name: "Create Coupons", description: "Generate new coupons" },
      { slug: "coupons.edit", name: "Edit Coupons", description: "Modify discount values and limits" },
      { slug: "coupons.delete", name: "Delete Coupons", description: "Deactivate or delete coupons" },
    ],
  },
  {
    category: "CMS",
    permissions: [
      { slug: "cms.view", name: "View CMS", description: "View banners, pages, and menus" },
      { slug: "cms.create", name: "Create CMS Content", description: "Draft new banners and pages" },
      { slug: "cms.edit", name: "Edit CMS Content", description: "Update content blocks and navigation" },
      { slug: "cms.publish", name: "Publish CMS Content", description: "Publish CMS changes to live storefront" },
    ],
  },
  {
    category: "Reviews",
    permissions: [
      { slug: "reviews.view", name: "View Reviews", description: "View product reviews and ratings" },
      { slug: "reviews.moderate", name: "Moderate Reviews", description: "Approve, flag, or remove reviews" },
    ],
  },
  {
    category: "Support",
    permissions: [
      { slug: "support.view", name: "View Support", description: "View support tickets" },
      { slug: "support.respond", name: "Respond to Support", description: "Post replies to customer/vendor tickets" },
      { slug: "support.assign", name: "Assign Support", description: "Reassign tickets to employees" },
    ],
  },
  {
    category: "Analytics",
    permissions: [
      { slug: "analytics.view", name: "View Analytics", description: "Access platform analytics and reports" },
      { slug: "analytics.export", name: "Export Analytics", description: "Export analytical reports" },
    ],
  },
  {
    category: "Tasks",
    permissions: [
      { slug: "tasks.view", name: "View Tasks", description: "View assigned and team tasks" },
      { slug: "tasks.create", name: "Create Tasks", description: "Create work assignments and tasks" },
      { slug: "tasks.assign", name: "Assign Tasks", description: "Assign tasks to staff members" },
      { slug: "tasks.edit", name: "Edit Tasks", description: "Update task status, priority, and notes" },
      { slug: "tasks.complete", name: "Complete Tasks", description: "Mark tasks as completed" },
    ],
  },
  {
    category: "Activity Logs",
    permissions: [
      { slug: "activity_logs.view", name: "View Activity Logs", description: "Inspect system audit trails" },
      { slug: "activity_logs.export", name: "Export Activity Logs", description: "Export audit trails" },
    ],
  },
  {
    category: "Staff",
    permissions: [
      { slug: "staff.view", name: "View Staff", description: "View staff list and profiles" },
      { slug: "staff.create", name: "Create Staff", description: "Provision new Admin or Editor accounts" },
      { slug: "staff.edit", name: "Edit Staff", description: "Update staff details" },
      { slug: "staff.suspend", name: "Suspend Staff", description: "Suspend or reactivate staff accounts" },
    ],
  },
  {
    category: "Permissions",
    permissions: [
      { slug: "permissions.view", name: "View Permissions", description: "View permission matrix" },
      { slug: "permissions.manage", name: "Manage Permissions", description: "Assign or revoke employee permissions" },
    ],
  },
  {
    category: "Platform Settings",
    permissions: [
      { slug: "platform_settings.view", name: "View Platform Settings", description: "View system configurations" },
      { slug: "platform_settings.manage", name: "Manage Platform Settings", description: "Update marketplace and checkout settings" },
    ],
  },
  {
    category: "Platform Credentials",
    permissions: [
      { slug: "platform_credentials.view", name: "View Platform Credentials", description: "View integration credential statuses" },
      { slug: "platform_credentials.manage", name: "Manage Platform Credentials", description: "Update encrypted third-party credentials" },
    ],
  },
]);

module.exports = {
  PERMISSIONS,
  ALIAS_MAP,
  resolvePermissionAliases,
  SECTION5_CATALOG,
};