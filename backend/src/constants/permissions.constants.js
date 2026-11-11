const CANONICAL_PERMISSIONS = {
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

  DISCOUNTS_READ: "discounts:read",
  DISCOUNTS_MANAGE: "discounts:manage",
  PROMOTIONS_OVERRIDE_FLOOR: "promotions:override_floor",

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
};

// Section 5 Granular Namespaced Permissions (attached non-enumerable to preserve 49-canonical count)
const SECTION5_PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_EDIT: "customers.edit",
  CUSTOMERS_SUSPEND: "customers.suspend",
  CUSTOMERS_RESET_PASSWORD: "customers.reset_password",
  CUSTOMERS_DELETE: "customers.delete",
  CUSTOMERS_EXPORT: "customers.export",

  VENDORS_VIEW: "vendors.view",
  VENDORS_APPROVE: "vendors.approve",
  VENDORS_REJECT: "vendors.reject",
  VENDORS_REQUEST_CHANGES: "vendors.request_changes",
  VENDORS_SUSPEND: "vendors.suspend",
  VENDORS_EDIT: "vendors.edit",
  VENDORS_RESET_PASSWORD: "vendors.reset_password",
  VENDORS_DELETE: "vendors.delete",
  VENDORS_EXPORT: "vendors.export",

  VENDORS_BANK_ACCOUNTS_VIEW: "vendors.bank_accounts.view",
  VENDORS_BANK_ACCOUNTS_REVIEW: "vendors.bank_accounts.review",
  VENDORS_BANK_ACCOUNTS_APPROVE: "vendors.bank_accounts.approve",
  VENDORS_BANK_ACCOUNTS_REJECT: "vendors.bank_accounts.reject",
  VENDORS_BANK_ACCOUNTS_MANAGE: "vendors.bank_accounts.manage",
  VENDORS_BANK_ACCOUNTS_VIEW_UNMASKED: "vendors.bank_accounts.view_unmasked",

  VENDORS_KYC_VIEW: "vendors.kyc.view",
  VENDORS_KYC_REVIEW: "vendors.kyc.review",
  VENDORS_KYC_APPROVE: "vendors.kyc.approve",
  VENDORS_KYC_REJECT: "vendors.kyc.reject",

  PARTNER_BANKS_VIEW: "partner_banks.view",
  PARTNER_BANKS_MANAGE: "partner_banks.manage",

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

  ATTRIBUTES_VIEW: "attributes.view",
  ATTRIBUTES_CREATE: "attributes.create",
  ATTRIBUTES_EDIT: "attributes.edit",
  ATTRIBUTES_DELETE: "attributes.delete",

  INVENTORY_VIEW: "inventory.view",
  INVENTORY_ADJUST: "inventory.adjust",
  INVENTORY_TRANSFER: "inventory.transfer",
  INVENTORY_MANAGE_SEC5: "inventory.manage",
  INVENTORY_CREATE: "inventory.create",
  INVENTORY_EXPORT: "inventory.export",

  WAREHOUSES_VIEW: "warehouses.view",
  WAREHOUSES_CREATE: "warehouses.create",
  WAREHOUSES_EDIT: "warehouses.edit",
  WAREHOUSES_MANAGE_INVENTORY: "warehouses.manage_inventory",
  WAREHOUSES_MANAGE_SEC5: "warehouses.manage",
  WAREHOUSES_DELETE: "warehouses.delete",

  ORDERS_VIEW: "orders.view",
  ORDERS_EDIT: "orders.edit",
  ORDERS_CANCEL: "orders.cancel",
  ORDERS_MANAGE_SEC5: "orders.manage",
  ORDERS_EXPORT: "orders.export",

  RETURNS_VIEW: "returns.view",
  RETURNS_APPROVE: "returns.approve",
  RETURNS_REJECT: "returns.reject",

  REFUNDS_VIEW: "refunds.view",
  REFUNDS_CREATE: "refunds.create",
  REFUNDS_APPROVE: "refunds.approve",
  REFUND_APPLICATIONS_VIEW: "refund_applications.view",
  REFUND_APPLICATIONS_REVIEW: "refund_applications.review",
  REFUND_APPLICATIONS_APPROVE: "refund_applications.approve",
  REFUND_APPLICATIONS_REJECT: "refund_applications.reject",
  REFUND_APPLICATIONS_REVISE: "refund_applications.revise",
  REFUND_DISBURSEMENT_INITIATE: "refund_disbursements.initiate",

  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_RECONCILE: "payments.reconcile",
  PAYMENTS_MANAGE_SEC5: "payments.manage",

  SETTLEMENTS_VIEW: "settlements.view",
  SETTLEMENTS_MANAGE: "settlements.manage",

  FINANCE_VIEW: "finance.view",
  FINANCE_MANAGE_SEC5: "finance.manage",

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

  DISCOUNTS_VIEW: "discounts.view",
  DISCOUNTS_MANAGE_SEC5: "discounts.manage",
  PROMOTIONS_OVERRIDE_FLOOR_SEC5: "promotions.override_floor",

  CMS_VIEW: "cms.view",
  CMS_CREATE: "cms.create",
  CMS_EDIT: "cms.edit",
  CMS_PUBLISH: "cms.publish",
  CMS_DELETE: "cms.delete",
  CMS_EVENTS_VIEW: "cms.events.view",
  CMS_EVENTS_MANAGE: "cms.events.manage",

  TAX_VIEW: "tax.view",
  TAX_MANAGE_SEC5: "tax.manage",

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
};

const PERMISSIONS = { ...CANONICAL_PERMISSIONS };
for (const [key, val] of Object.entries(SECTION5_PERMISSIONS)) {
  Object.defineProperty(PERMISSIONS, key, {
    value: val,
    enumerable: false,
    writable: false,
    configurable: false,
  });
}
Object.freeze(PERMISSIONS);


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
  "customers.reset_password": ["users:manage"],
  "customers.delete": ["users:manage"],
  "customers.export": ["users:read"],
  "vendors.view": ["vendors:read"],
  "vendors.approve": ["vendors:manage"],
  "vendors.reject": ["vendors:manage"],
  "vendors.request_changes": ["vendors:manage"],
  "vendors.suspend": ["vendors:manage"],
  "vendors.edit": ["vendors:manage"],
  "vendors.reset_password": ["vendors:manage"],
  "vendors.delete": ["vendors:manage"],
  "vendors.export": ["vendors:read"],
  "vendors.bank_accounts.view": ["vendors:manage", "vendors:read", "finance:read", "finance:manage"],
  "vendors.bank_accounts.review": ["vendors:manage", "finance:manage"],
  "vendors.bank_accounts.approve": ["vendors:manage", "finance:manage"],
  "vendors.bank_accounts.reject": ["vendors:manage", "finance:manage"],
  "vendors.bank_accounts.manage": ["vendors:manage", "finance:manage"],
  "vendors.bank_accounts.view_unmasked": ["vendors:manage"],
  "partner_banks.view": ["vendors:manage", "vendors:read", "finance:read", "finance:manage"],
  "partner_banks.manage": ["vendors:manage", "finance:manage"],
  "vendors.kyc.view": ["vendors:manage", "vendors:read"],
  "vendors.kyc.review": ["vendors:manage"],
  "vendors.kyc.approve": ["vendors:manage"],
  "vendors.kyc.reject": ["vendors:manage"],
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
  "attributes.view": ["products:read"],
  "attributes.create": ["products:create"],
  "attributes.edit": ["products:update"],
  "attributes.delete": ["products:delete"],
  "inventory.view": ["inventory:read"],
  "inventory.adjust": ["inventory:manage"],
  "inventory.transfer": ["inventory:manage"],
  "inventory.manage": ["inventory:manage"],
  "inventory.create": ["inventory:manage"],
  "inventory.export": ["inventory:read"],
  "warehouses.view": ["warehouses:read"],
  "warehouses.create": ["warehouses:manage"],
  "warehouses.edit": ["warehouses:manage"],
  "warehouses.manage_inventory": ["warehouses:manage"],
  "warehouses.manage": ["warehouses:manage"],
  "warehouses.delete": ["warehouses:manage"],
  "orders.view": ["orders:read"],
  "orders.edit": ["orders:manage"],
  "orders.cancel": ["orders:manage"],
  "orders.manage": ["orders:manage"],
  "orders.export": ["orders:read"],
  "returns.view": ["orders:read"],
  "returns.approve": ["orders:manage"],
  "returns.reject": ["orders:manage"],
  "refunds.view": ["finance:read"],
  "refunds.create": ["finance:manage"],
  "refunds.approve": ["finance:manage"],
  "refund_applications.view": ["refunds.view", "finance:read"],
  "refund_applications.review": ["refunds.approve"],
  "refund_applications.approve": ["refunds.approve"],
  "refund_applications.reject": ["refunds.approve"],
  "refund_applications.revise": ["refunds.approve"],
  "refund_disbursements.initiate": ["refunds.create"],
  "payments.view": ["payments:read"],
  "payments.reconcile": ["payments:manage"],
  "payments.manage": ["payments:manage"],
  "settlements.view": ["finance:read"],
  "settlements.manage": ["finance:manage"],
  "finance.view": ["finance:read", "settlements.view"],
  "finance.manage": ["finance:manage", "settlements.manage"],
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
  "cms.delete": ["settings:manage"],
  "cms.events.view": ["settings:read"],
  "cms.events.manage": ["settings:manage"],
  "tax.view": ["tax:read"],
  "tax.manage": ["tax:manage"],
  "tax:read": ["tax.view"],
  "tax:manage": ["tax.manage"],
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

  "discounts:read": ["discounts.view", "coupons:read", "campaigns:read"],
  "discounts:manage": ["discounts.manage", "coupons:manage", "campaigns:manage"],
  "promotions:override_floor": ["promotions.override_floor"],
  "discounts.view": ["discounts:read"],
  "discounts.manage": ["discounts:manage"],
  "promotions.override_floor": ["promotions:override_floor"],

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

  // Colon -> Dot (1-to-1 synonyms; broad permissions do not leak to narrow sub-permissions)
  "audit_logs:read": ["activity_logs.view"],
  "products:read": ["products.view"],
  "products:create": ["products.create"],
  "products:update": ["products.edit"],
  "products:delete": ["products.delete"],
  "products:moderate": ["products.approve", "products.reject"],
  "inventory:read": ["inventory.view"],
  "inventory:manage": ["inventory.manage"],
  "warehouses:read": ["warehouses.view"],
  "warehouses:manage": ["warehouses.manage"],
  "shipments:read": ["shipping.view"],
  "shipments:manage": ["shipping.manage"],
  "orders:read": ["orders.view"],
  "orders:manage": ["orders.manage"],
  "users:read": ["customers.view"],
  "users:manage": [
    "customers.edit",
    "customers.suspend",
    "customers.reset_password",
    "customers.delete",
  ],
  "vendors:read": ["vendors.view", "vendors.kyc.view"],
  "vendors:manage": [
    "vendors.edit",
    "vendors.approve",
    "vendors.reject",
    "vendors.suspend",
    "vendors.request_changes",
    "vendors.reset_password",
    "vendors.delete",
    "vendors.bank_accounts.view",
    "vendors.bank_accounts.review",
    "vendors.bank_accounts.approve",
    "vendors.bank_accounts.reject",
    "vendors.bank_accounts.manage",
    "vendors.bank_accounts.view_unmasked",
    "partner_banks.view",
    "partner_banks.manage",
    "vendors.kyc.view",
    "vendors.kyc.review",
    "vendors.kyc.approve",
    "vendors.kyc.reject",
  ],
  "payments:read": ["payments.view"],
  "payments:manage": ["payments.manage", "payments.reconcile"],
  "finance:read": ["finance.view", "settlements.view", "partner_banks.view"],
  "finance:manage": [
    "finance.manage",
    "settlements.manage",
    "vendors.bank_accounts.view",
    "vendors.bank_accounts.review",
    "vendors.bank_accounts.approve",
    "vendors.bank_accounts.reject",
    "vendors.bank_accounts.manage",
    "partner_banks.view",
    "partner_banks.manage",
  ],
  "settings:read": [
    "platform_settings.view",
    "platform_credentials.view",
    "authentication.login_methods.read",
  ],
  "settings:manage": [
    "platform_settings.manage",
    "platform_credentials.manage",
    "authentication.login_methods.manage",
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
      { slug: "customers.reset_password", name: "Reset Password", description: "Securely reset customer authentication credentials" },
      { slug: "customers.delete", name: "Deactivate Customer", description: "Safely deactivate customer accounts" },
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
      { slug: "vendors.reset_password", name: "Reset Password", description: "Securely reset vendor credentials and invalidate sessions" },
      { slug: "vendors.delete", name: "Deactivate Vendor", description: "Safely deactivate vendor accounts and delist products" },
      { slug: "vendors.export", name: "Export Vendors", description: "Export vendor lists and data" },
    ],
  },
  {
    category: "Vendor Bank Accounts",
    permissions: [
      { slug: "vendors.bank_accounts.view", name: "View Vendor Bank Accounts", description: "View masked vendor bank accounts and review queue" },
      { slug: "vendors.bank_accounts.review", name: "Review Vendor Bank Accounts", description: "Mark bank account applications under review" },
      { slug: "vendors.bank_accounts.approve", name: "Approve Vendor Bank Accounts", description: "Approve pending vendor bank account applications" },
      { slug: "vendors.bank_accounts.reject", name: "Reject Vendor Bank Accounts", description: "Reject vendor bank account applications with reason" },
      { slug: "vendors.bank_accounts.manage", name: "Manage Vendor Bank Accounts", description: "Administratively create, edit, activate, deactivate, or delete vendor bank accounts" },
      { slug: "vendors.bank_accounts.view_unmasked", name: "View Unmasked Bank Account", description: "Privileged access to unmasked bank account numbers with audit logging" },
      { slug: "partner_banks.view", name: "View Partner Banks", description: "View partner bank catalogue and directory" },
      { slug: "partner_banks.manage", name: "Manage Partner Banks", description: "Create, edit, enable, disable partner bank directory entries" },
    ],
  },
  {
    category: "Vendor KYC & Compliance",
    permissions: [
      { slug: "vendors.kyc.view", name: "View Vendor KYC", description: "View vendor KYC documents and compliance status" },
      { slug: "vendors.kyc.review", name: "Review Vendor KYC", description: "Review and inspect vendor KYC verification submissions" },
      { slug: "vendors.kyc.approve", name: "Approve Vendor KYC", description: "Approve vendor KYC documents" },
      { slug: "vendors.kyc.reject", name: "Reject Vendor KYC", description: "Reject vendor KYC documents with mandatory reason" },
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
    category: "Attributes",
    permissions: [
      { slug: "attributes.view", name: "View Attributes", description: "View product attributes and values" },
      { slug: "attributes.create", name: "Create Attributes", description: "Create product attributes" },
      { slug: "attributes.edit", name: "Edit Attributes", description: "Update product attributes" },
      { slug: "attributes.delete", name: "Delete Attributes", description: "Remove product attributes" },
    ],
  },
  {
    category: "Inventory",
    permissions: [
      { slug: "inventory.view", name: "View Inventory", description: "Inspect inventory levels across warehouses" },
      { slug: "inventory.adjust", name: "Adjust Stock", description: "Perform manual stock adjustments" },
      { slug: "inventory.transfer", name: "Transfer Stock", description: "Initiate warehouse stock transfers" },
      { slug: "inventory.create", name: "Create Inventory", description: "Add new stock batches" },
      { slug: "inventory.manage", name: "Manage Inventory", description: "Manage full inventory configurations" },
      { slug: "inventory.export", name: "Export Inventory", description: "Export inventory datasets" },
    ],
  },
  {
    category: "Warehouses",
    permissions: [
      { slug: "warehouses.view", name: "View Warehouses", description: "View warehouse locations" },
      { slug: "warehouses.create", name: "Create Warehouses", description: "Add new warehouse facilities" },
      { slug: "warehouses.edit", name: "Edit Warehouses", description: "Update warehouse details and zones" },
      { slug: "warehouses.manage", name: "Manage Warehouses", description: "Configure warehouse operational rules" },
      { slug: "warehouses.manage_inventory", name: "Manage Inventory", description: "Manage warehouse stock allocations" },
      { slug: "warehouses.delete", name: "Delete Warehouses", description: "Remove warehouse facilities" },
    ],
  },
  {
    category: "Orders",
    permissions: [
      { slug: "orders.view", name: "View Orders", description: "View order queue and customer order details" },
      { slug: "orders.edit", name: "Edit Orders", description: "Update order delivery details and notes" },
      { slug: "orders.cancel", name: "Cancel Orders", description: "Cancel unfulfilled orders" },
      { slug: "orders.manage", name: "Manage Orders", description: "Manage order lifecycles and statuses" },
      { slug: "orders.export", name: "Export Orders", description: "Export order records" },
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
      { slug: "refund_applications.view", name: "View Refund Applications", description: "View merchant refund applications queue" },
      { slug: "refund_applications.review", name: "Review Refund Applications", description: "Review and inspect merchant refund applications" },
      { slug: "refund_applications.approve", name: "Approve Refund Applications", description: "Authorize merchant refund applications" },
      { slug: "refund_applications.reject", name: "Reject Refund Applications", description: "Decline merchant refund applications with reason" },
      { slug: "refund_applications.revise", name: "Request Application Revision", description: "Request inspection or evidence revisions from merchant" },
      { slug: "refund_disbursements.initiate", name: "Initiate Refund Disbursement", description: "Execute live customer refund disbursement via payment gateway" },
    ],
  },
  {
    category: "Payments",
    permissions: [
      { slug: "payments.view", name: "View Payments", description: "View gateway payments and transactions" },
      { slug: "payments.reconcile", name: "Reconcile Payments", description: "Perform payment reconciliation" },
      { slug: "payments.manage", name: "Manage Payments", description: "Configure payment gateways and dispute settlements" },
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
    category: "Finance",
    permissions: [
      { slug: "finance.view", name: "View Finance", description: "View financial ledger, wallets, and reconciliation overviews" },
      { slug: "finance.manage", name: "Manage Finance", description: "Manage commission policies, payouts, and ledger adjustments" },
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
    category: "Discounts",
    permissions: [
      { slug: "discounts.view", name: "View Discounts", description: "View store discounts and promotions" },
      { slug: "discounts.manage", name: "Manage Discounts", description: "Manage discount rules and promotional tiers" },
      { slug: "promotions.override_floor", name: "Override Price Floor", description: "Override minimum promotional price floors" },
    ],
  },
  {
    category: "CMS",
    permissions: [
      { slug: "cms.view", name: "View CMS", description: "View banners, pages, and menus" },
      { slug: "cms.create", name: "Create CMS Content", description: "Draft new banners and pages" },
      { slug: "cms.edit", name: "Edit CMS Content", description: "Update content blocks and navigation" },
      { slug: "cms.publish", name: "Publish CMS Content", description: "Publish CMS changes to live storefront" },
      { slug: "cms.delete", name: "Delete CMS Content", description: "Remove pages, banners, or content sections" },
      { slug: "cms.events.view", name: "View Special Events", description: "View CMS Special Event pages and builder" },
      { slug: "cms.events.manage", name: "Manage Special Events", description: "Create, build, schedule, and publish CMS Special Event pages" },
    ],
  },
  {
    category: "Tax",
    permissions: [
      { slug: "tax.view", name: "View Tax", description: "View tax rates and jurisdictions" },
      { slug: "tax.manage", name: "Manage Tax", description: "Configure tax rules, rates, and exemptions" },
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
    category: "Job Roles",
    permissions: [
      { slug: "job_roles.view", name: "View Job Roles", description: "View dynamic job roles and permissions" },
      { slug: "job_roles.create", name: "Create Job Roles", description: "Define custom organizational job roles" },
      { slug: "job_roles.edit", name: "Edit Job Roles", description: "Modify job role permissions and titles" },
      { slug: "job_roles.delete", name: "Delete Job Roles", description: "Remove unused job roles" },
      { slug: "job_roles.reorder", name: "Reorder Job Roles", description: "Update role hierarchy ordering" },
      { slug: "job_roles.migrate", name: "Migrate Job Roles", description: "Reassign staff during role deprecation" },
    ],
  },
  {
    category: "Employee Governance",
    permissions: [
      { slug: "employee.assign_role", name: "Assign Roles", description: "Assign job roles to employees" },
      { slug: "employee.view", name: "View Employees", description: "View internal employee records" },
      { slug: "employee.create", name: "Create Employees", description: "Provision new employee records" },
      { slug: "employee.edit", name: "Edit Employees", description: "Update employee assignments and scopes" },
      { slug: "employee.delete", name: "Delete Employees", description: "Decommission employee records" },
      { slug: "governance.superadmin_transfer", name: "Transfer Superadmin", description: "Perform transfer of platform Superadmin authority" },
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
  {
    category: "Authentication Methods",
    permissions: [
      { slug: "authentication.login_methods.read", name: "View Login Methods", description: "View configured customer and vendor login authentication methods" },
      { slug: "authentication.login_methods.manage", name: "Manage Login Methods", description: "Configure customer and vendor authentication methods, OTP, and SSO" },
    ],
  },
]);

module.exports = {
  PERMISSIONS,
  SECTION5_PERMISSIONS,
  ALIAS_MAP,
  resolvePermissionAliases,
  SECTION5_CATALOG,
};