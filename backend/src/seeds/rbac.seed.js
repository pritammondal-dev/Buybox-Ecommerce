const { PERMISSIONS } = require("../constants/permissions.constants");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const RolePermission = require("../models/RolePermission");

/**
 * 47 Atomic Permission Definitions
 * 38 Existing Operational Permissions + 9 Dynamic RBAC Management Permissions
 */
const PERMISSION_DEFINITIONS = [
  // Products (4)
  {
    slug: PERMISSIONS.PRODUCTS_READ,
    name: "Read Products",
    module: "products",
    description: "View product catalog, details and variants",
  },
  {
    slug: PERMISSIONS.PRODUCTS_CREATE,
    name: "Create Products",
    module: "products",
    description: "Create new product listings",
  },
  {
    slug: PERMISSIONS.PRODUCTS_UPDATE,
    name: "Update Products",
    module: "products",
    description: "Modify existing product details and pricing",
  },
  {
    slug: PERMISSIONS.PRODUCTS_DELETE,
    name: "Delete Products",
    module: "products",
    description: "Soft-delete products from the catalog",
  },

  // Inventory (2)
  {
    slug: PERMISSIONS.INVENTORY_READ,
    name: "Read Inventory",
    module: "inventory",
    description: "View inventory stock levels across warehouses",
  },
  {
    slug: PERMISSIONS.INVENTORY_MANAGE,
    name: "Manage Inventory",
    module: "inventory",
    description: "Adjust, reserve, and reconcile inventory stock",
  },

  // Warehouses (2)
  {
    slug: PERMISSIONS.WAREHOUSES_READ,
    name: "Read Warehouses",
    module: "warehouses",
    description: "View warehouse facility details and locations",
  },
  {
    slug: PERMISSIONS.WAREHOUSES_MANAGE,
    name: "Manage Warehouses",
    module: "warehouses",
    description: "Create, update and configure warehouse facilities",
  },

  // Shipments (4)
  {
    slug: PERMISSIONS.SHIPMENTS_READ,
    name: "Read Shipments",
    module: "shipments",
    description: "View all platform shipments and tracking info",
  },
  {
    slug: PERMISSIONS.SHIPMENTS_MANAGE,
    name: "Manage Shipments",
    module: "shipments",
    description: "Create, dispatch, and update shipment status platform-wide",
  },
  {
    slug: PERMISSIONS.SHIPMENTS_READ_OWN,
    name: "Read Own Shipments",
    module: "shipments",
    description: "View shipments belonging to the authenticated vendor",
  },
  {
    slug: PERMISSIONS.SHIPMENTS_MANAGE_OWN,
    name: "Manage Own Shipments",
    module: "shipments",
    description: "Create and update shipments for own vendor orders",
  },

  // Orders (2)
  {
    slug: PERMISSIONS.ORDERS_READ,
    name: "Read Orders",
    module: "orders",
    description: "View order summaries and details",
  },
  {
    slug: PERMISSIONS.ORDERS_MANAGE,
    name: "Manage Orders",
    module: "orders",
    description: "Update order status and handle cancellations",
  },

  // Users (2)
  {
    slug: PERMISSIONS.USERS_READ,
    name: "Read Users",
    module: "users",
    description: "View user profiles and account metadata",
  },
  {
    slug: PERMISSIONS.USERS_MANAGE,
    name: "Manage Users",
    module: "users",
    description: "Update user status, accounts, and details",
  },

  // Vendors (2)
  {
    slug: PERMISSIONS.VENDORS_READ,
    name: "Read Vendors",
    module: "vendors",
    description: "View vendor business profiles and verification data",
  },
  {
    slug: PERMISSIONS.VENDORS_MANAGE,
    name: "Manage Vendors",
    module: "vendors",
    description: "Approve, suspend, and configure vendor accounts",
  },

  // Payments (2)
  {
    slug: PERMISSIONS.PAYMENTS_READ,
    name: "Read Payments",
    module: "payments",
    description: "View payment records, gateway transactions, and receipts",
  },
  {
    slug: PERMISSIONS.PAYMENTS_MANAGE,
    name: "Manage Payments",
    module: "payments",
    description: "Initiate payment captures and issue refunds",
  },

  // Finance (2)
  {
    slug: PERMISSIONS.FINANCE_READ,
    name: "Read Finance",
    module: "finance",
    description: "View financial ledger, vendor settlements, and payouts",
  },
  {
    slug: PERMISSIONS.FINANCE_MANAGE,
    name: "Manage Finance",
    module: "finance",
    description: "Process settlements, release payouts, and adjust ledger",
  },

  // Reports (1)
  {
    slug: PERMISSIONS.REPORTS_READ,
    name: "Read Reports",
    module: "reports",
    description: "Access operational and financial performance reports",
  },

  // Settings (2)
  {
    slug: PERMISSIONS.SETTINGS_READ,
    name: "Read Settings",
    module: "settings",
    description: "View store and platform configuration",
  },
  {
    slug: PERMISSIONS.SETTINGS_MANAGE,
    name: "Manage Settings",
    module: "settings",
    description: "Update platform settings and configuration tokens",
  },

  // Coupons (2)
  {
    slug: PERMISSIONS.COUPONS_READ,
    name: "Read Coupons",
    module: "coupons",
    description: "View available coupons and discount rules",
  },
  {
    slug: PERMISSIONS.COUPONS_MANAGE,
    name: "Manage Coupons",
    module: "coupons",
    description: "Create, update, and deactivate discount coupons",
  },

  // Campaigns (2)
  {
    slug: PERMISSIONS.CAMPAIGNS_READ,
    name: "Read Campaigns",
    module: "campaigns",
    description: "View marketing campaigns and performance stats",
  },
  {
    slug: PERMISSIONS.CAMPAIGNS_MANAGE,
    name: "Manage Campaigns",
    module: "campaigns",
    description: "Create, modify, and schedule marketing campaigns",
  },

  // Reviews (3)
  {
    slug: PERMISSIONS.REVIEWS_READ,
    name: "Read Reviews",
    module: "reviews",
    description: "View customer product reviews and ratings",
  },
  {
    slug: PERMISSIONS.REVIEWS_MANAGE,
    name: "Manage Reviews",
    module: "reviews",
    description: "Respond to customer reviews for own products",
  },
  {
    slug: PERMISSIONS.REVIEWS_MODERATE,
    name: "Moderate Reviews",
    module: "reviews",
    description: "Approve, reject, or hide customer reviews platform-wide",
  },

  // Support Tickets (2)
  {
    slug: PERMISSIONS.SUPPORT_TICKETS_READ,
    name: "Read Support Tickets",
    module: "support_tickets",
    description: "View customer support tickets and ticket history",
  },
  {
    slug: PERMISSIONS.SUPPORT_TICKETS_MANAGE,
    name: "Manage Support Tickets",
    module: "support_tickets",
    description: "Assign, update, transition and reply to support tickets",
  },

  // Tax (2)
  {
    slug: PERMISSIONS.TAX_READ,
    name: "Read Tax",
    module: "tax",
    description: "View tax categories and rule rates",
  },
  {
    slug: PERMISSIONS.TAX_MANAGE,
    name: "Manage Tax",
    module: "tax",
    description: "Create and update regional tax rules and rates",
  },

  // Analytics (2)
  {
    slug: PERMISSIONS.ANALYTICS_READ,
    name: "Read Analytics",
    module: "analytics",
    description: "View platform-wide sales and traffic analytics",
  },
  {
    slug: PERMISSIONS.ANALYTICS_READ_OWN,
    name: "Read Own Analytics",
    module: "analytics",
    description: "View vendor-scoped store sales and traffic analytics",
  },

  // Dynamic RBAC / PBAC Governance Permissions (9)
  {
    slug: PERMISSIONS.ROLES_READ,
    name: "Read Roles",
    module: "roles",
    description: "View role definitions and assigned role permissions",
  },
  {
    slug: PERMISSIONS.ROLES_MANAGE,
    name: "Manage Roles",
    module: "roles",
    description: "Create, update, deactivate, and configure roles",
  },
  {
    slug: PERMISSIONS.PERMISSIONS_READ,
    name: "Read Permissions",
    module: "permissions",
    description: "View atomic permission catalog",
  },
  {
    slug: PERMISSIONS.PERMISSIONS_MANAGE,
    name: "Manage Permissions",
    module: "permissions",
    description: "Configure role-permission mappings and overrides",
  },
  {
    slug: PERMISSIONS.EMPLOYEES_READ,
    name: "Read Employees",
    module: "employees",
    description: "View internal staff and employee profiles",
  },
  {
    slug: PERMISSIONS.EMPLOYEES_MANAGE,
    name: "Manage Employees",
    module: "employees",
    description: "Invite, activate, suspend, and configure employee access",
  },
  {
    slug: PERMISSIONS.WORK_ASSIGNMENTS_READ,
    name: "Read Work Assignments",
    module: "work_assignments",
    description: "View employee work assignments and scopes",
  },
  {
    slug: PERMISSIONS.WORK_ASSIGNMENTS_MANAGE,
    name: "Manage Work Assignments",
    module: "work_assignments",
    description: "Assign or revoke employee work scopes (vendor, queue, warehouse)",
  },
  {
    slug: PERMISSIONS.AUDIT_LOGS_READ,
    name: "Read Audit Logs",
    module: "audit_logs",
    description: "Inspect privileged audit trail and permission change history",
  },
];

/**
 * 6 System Role Definitions
 */
const SYSTEM_ROLES = [
  {
    name: "System Customer",
    slug: "system_customer",
    description: "Default storefront customer purchasing profile",
    isSystem: true,
    isActive: true,
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.REVIEWS_READ,
    ],
  },
  {
    name: "System Vendor",
    slug: "system_vendor",
    description: "Marketplace vendor selling and catalog profile",
    isSystem: true,
    isActive: true,
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.REVIEWS_READ,
      PERMISSIONS.REVIEWS_MANAGE,
      PERMISSIONS.SHIPMENTS_READ_OWN,
      PERMISSIONS.SHIPMENTS_MANAGE_OWN,
      PERMISSIONS.ANALYTICS_READ_OWN,
    ],
  },
  {
    name: "System Support",
    slug: "system_support",
    description: "Customer support tier 1 and tier 2 staff",
    isSystem: true,
    isActive: true,
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.VENDORS_READ,
      PERMISSIONS.REVIEWS_READ,
      PERMISSIONS.SUPPORT_TICKETS_READ,
      PERMISSIONS.SUPPORT_TICKETS_MANAGE,
    ],
  },
  {
    name: "System Manager",
    slug: "system_manager",
    description: "Operational supervisor across inventory, warehouses, shipments and orders",
    isSystem: true,
    isActive: true,
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.WAREHOUSES_READ,
      PERMISSIONS.WAREHOUSES_MANAGE,
      PERMISSIONS.SHIPMENTS_READ,
      PERMISSIONS.SHIPMENTS_MANAGE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.VENDORS_READ,
      PERMISSIONS.REVIEWS_READ,
      PERMISSIONS.REVIEWS_MANAGE,
      PERMISSIONS.REVIEWS_MODERATE,
      PERMISSIONS.SUPPORT_TICKETS_READ,
      PERMISSIONS.SUPPORT_TICKETS_MANAGE,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.FINANCE_READ,
      PERMISSIONS.FINANCE_MANAGE,
      PERMISSIONS.COUPONS_READ,
      PERMISSIONS.COUPONS_MANAGE,
      PERMISSIONS.CAMPAIGNS_READ,
      PERMISSIONS.CAMPAIGNS_MANAGE,
      PERMISSIONS.TAX_READ,
      PERMISSIONS.TAX_MANAGE,
      PERMISSIONS.ANALYTICS_READ,
    ],
  },
  {
    name: "System Admin",
    slug: "system_admin",
    description: "Platform operational administrator",
    isSystem: true,
    isActive: true,
    // All 38 operational platform permissions (excludes Super Admin governance permissions)
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.PRODUCTS_DELETE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.WAREHOUSES_READ,
      PERMISSIONS.WAREHOUSES_MANAGE,
      PERMISSIONS.SHIPMENTS_READ,
      PERMISSIONS.SHIPMENTS_MANAGE,
      PERMISSIONS.SHIPMENTS_READ_OWN,
      PERMISSIONS.SHIPMENTS_MANAGE_OWN,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.VENDORS_READ,
      PERMISSIONS.VENDORS_MANAGE,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.PAYMENTS_MANAGE,
      PERMISSIONS.FINANCE_READ,
      PERMISSIONS.FINANCE_MANAGE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.COUPONS_READ,
      PERMISSIONS.COUPONS_MANAGE,
      PERMISSIONS.CAMPAIGNS_READ,
      PERMISSIONS.CAMPAIGNS_MANAGE,
      PERMISSIONS.REVIEWS_READ,
      PERMISSIONS.REVIEWS_MANAGE,
      PERMISSIONS.REVIEWS_MODERATE,
      PERMISSIONS.SUPPORT_TICKETS_READ,
      PERMISSIONS.SUPPORT_TICKETS_MANAGE,
      PERMISSIONS.TAX_READ,
      PERMISSIONS.TAX_MANAGE,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ANALYTICS_READ_OWN,
    ],
  },
  {
    name: "System Super Admin",
    slug: "system_super_admin",
    description: "Supreme platform governance and security authority",
    isSystem: true,
    isActive: true,
    // ALL 47 permissions: 38 operational + 9 RBAC governance
    permissions: Object.values(PERMISSIONS),
  },
];

/**
 * Deterministically seed the dynamic RBAC/PBAC database catalog.
 * Idempotent: safe to run multiple times without duplicating records.
 *
 * @returns {Promise<{ permissionsSeeded: number, rolesSeeded: number, mappingsSeeded: number }>}
 */
const seedRbac = async () => {
  // 1. Seed Permissions
  const permissionMap = new Map();
  for (const def of PERMISSION_DEFINITIONS) {
    const permission = await Permission.findOneAndUpdate(
      { slug: def.slug },
      {
        $set: {
          name: def.name,
          module: def.module,
          description: def.description,
          isSystem: true,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    permissionMap.set(def.slug, permission);
  }

  // 2. Seed System Roles
  const roleMap = new Map();
  for (const roleDef of SYSTEM_ROLES) {
    const role = await Role.findOneAndUpdate(
      { slug: roleDef.slug },
      {
        $set: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    roleMap.set(roleDef.slug, role);
  }

  // 3. Seed RolePermission Mappings
  let mappingsSeeded = 0;
  for (const roleDef of SYSTEM_ROLES) {
    const role = roleMap.get(roleDef.slug);
    for (const permSlug of roleDef.permissions) {
      const permission = permissionMap.get(permSlug);
      if (permission && role) {
        await RolePermission.findOneAndUpdate(
          {
            roleId: role._id,
            permissionId: permission._id,
          },
          {
            $setOnInsert: {
              roleId: role._id,
              permissionId: permission._id,
            },
          },
          { upsert: true, returnDocument: "after" }
        );
        mappingsSeeded += 1;
      }
    }
  }

  return {
    permissionsSeeded: permissionMap.size,
    rolesSeeded: roleMap.size,
    mappingsSeeded,
  };
};

module.exports = {
  PERMISSION_DEFINITIONS,
  SYSTEM_ROLES,
  seedRbac,
};
