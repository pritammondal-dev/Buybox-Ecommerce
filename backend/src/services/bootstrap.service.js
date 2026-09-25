const User = require("../models/User");
const Employee = require("../models/Employee");
const JobRole = require("../models/JobRole");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const RolePermission = require("../models/RolePermission");
const EmployeeRole = require("../models/EmployeeRole");
const logger = require("../config/logger");
const { hashPassword } = require("../utils/password");
const { ROLES } = require("../constants/auth.constants");
const {
  PERMISSIONS,
  SECTION5_CATALOG,
} = require("../constants/permissions.constants");
const {
  ROLE_PERMISSIONS,
} = require("../constants/role-permissions.constants");

/**
 * Bootstrap system roles, permissions, and the initial Superadmin account safely.
 *
 * Safe to execute repeatedly without duplicating data or overwriting existing passwords.
 */
const bootstrapSuperadmin = async () => {
  try {
    // 1. Seed System Roles
    const systemRoles = [
      {
        slug: ROLES.SUPER_ADMIN,
        name: "Super Administrator",
        description: "Full platform-level administrative and governance authority",
        isSystem: true,
      },
      {
        slug: ROLES.ADMIN,
        name: "Administrator",
        description: "Marketplace operations administrator with granular permissions",
        isSystem: true,
      },
      {
        slug: ROLES.EDITOR,
        name: "Editor",
        description: "Content, catalog, and operations employee with scoped permissions",
        isSystem: true,
      },
      {
        slug: ROLES.MANAGER,
        name: "Operations Manager",
        description: "Warehouse, inventory, and fulfillment operations manager",
        isSystem: true,
      },
      {
        slug: ROLES.SUPPORT,
        name: "Support Specialist",
        description: "Customer and vendor support representative",
        isSystem: true,
      },
    ];

    const roleDocs = {};
    for (const r of systemRoles) {
      let roleDoc = await Role.findOne({ slug: r.slug });
      if (!roleDoc) {
        roleDoc = await Role.create({
          name: r.name,
          slug: r.slug,
          description: r.description,
          isSystem: true,
          isActive: true,
        });
      }
      roleDocs[r.slug] = roleDoc;
    }

    // 2. Seed System Permissions (Section 5 catalog + Legacy keys)
    const permissionDocs = {};

    // First, seed from SECTION5_CATALOG
    for (const cat of SECTION5_CATALOG) {
      const moduleName = cat.category.toLowerCase().replace(/\s+/g, "_");
      for (const p of cat.permissions) {
        let permDoc = await Permission.findOne({ slug: p.slug });
        if (!permDoc) {
          permDoc = await Permission.create({
            name: p.name,
            slug: p.slug,
            module: moduleName,
            description: p.description,
            isSystem: true,
            isActive: true,
          });
        }
        permissionDocs[p.slug] = permDoc;
      }
    }

    // Second, seed any legacy colon permissions that aren't in catalog
    for (const [key, slug] of Object.entries(PERMISSIONS)) {
      if (!permissionDocs[slug]) {
        let permDoc = await Permission.findOne({ slug });
        if (!permDoc) {
          const moduleName = slug.split(":")[0] || "system";
          const humanName = key
            .toLowerCase()
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

          permDoc = await Permission.create({
            name: humanName,
            slug,
            module: moduleName,
            description: `Permission for ${slug}`,
            isSystem: true,
            isActive: true,
          });
        }
        permissionDocs[slug] = permDoc;
      }
    }

    // 3. Map Role Permissions
    for (const [roleSlug, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const roleDoc = roleDocs[roleSlug];
      if (!roleDoc) continue;

      for (const permSlug of permissions) {
        const permDoc = permissionDocs[permSlug];
        if (!permDoc) continue;

        const exists = await RolePermission.findOne({
          roleId: roleDoc._id,
          permissionId: permDoc._id,
        });

        if (!exists) {
          await RolePermission.create({
            roleId: roleDoc._id,
            permissionId: permDoc._id,
          });
        }
      }
    }

    // 4. Secure Bootstrap Superadmin Account
    const bootstrapEmail = (
      process.env.BOOTSTRAP_SUPERADMIN_EMAIL || "admin123@example.com"
    ).toLowerCase().trim();

    let superAdminUser = await User.findOne({ email: bootstrapEmail });

    if (!superAdminUser) {
      if (process.env.NODE_ENV === "production" && !process.env.BOOTSTRAP_SUPERADMIN_PASSWORD) {
        throw new Error(
          "CRITICAL: BOOTSTRAP_SUPERADMIN_PASSWORD must be provided via environment variables in production."
        );
      }

      // Create user only if not exists
      const bootstrapPassword =
        process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || "admin123";
      const hashedPassword = await hashPassword(bootstrapPassword);

      superAdminUser = await User.create({
        email: bootstrapEmail,
        password: hashedPassword,
        firstName: "Platform",
        lastName: "Superadmin",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isEmailVerified: true,
      });

      logger.info(
        { email: bootstrapEmail },
        "Bootstrap privileged account created securely"
      );
    }

    // 5. Ensure Superadmin has an Employee Profile
    let employeeDoc = await Employee.findOne({
      $or: [{ userId: superAdminUser._id }, { employeeNumber: "EMP-SUPER-001" }],
    });
    if (!employeeDoc) {
      employeeDoc = await Employee.create({
        userId: superAdminUser._id,
        employeeNumber: "EMP-SUPER-001",
        jobTitle: "Chief Platform Administrator",
        department: "Executive & Governance",
        status: "active",
        activatedAt: new Date(),
      });
    } else if (String(employeeDoc.userId) !== String(superAdminUser._id)) {
      employeeDoc.userId = superAdminUser._id;
      employeeDoc.status = "active";
      await employeeDoc.save();
    }

    // 6. Ensure Superadmin has EmployeeRole assignment
    if (roleDocs[ROLES.SUPER_ADMIN]) {
      const hasRole = await EmployeeRole.findOne({
        employeeId: employeeDoc._id,
        roleId: roleDocs[ROLES.SUPER_ADMIN]._id,
      });

      if (!hasRole) {
        await EmployeeRole.create({
          employeeId: employeeDoc._id,
          roleId: roleDocs[ROLES.SUPER_ADMIN]._id,
          assignedBy: superAdminUser._id,
          isActive: true,
        });
      }
    }

    // 7. Seed Initial Dynamic Job Roles (Hierarchical Tiers & Management Scope)
    const initialJobRoles = [
      {
        slug: "superadmin",
        name: "Superadmin",
        description: "Supreme platform authority, role governance, and platform executive",
        tier: 1,
        isSystemRole: true,
        isSuperadminRole: true,
        permissions: Object.values(PERMISSIONS),
      },
      {
        slug: "editor",
        name: "Editor",
        description: "Catalog curation and content publishing",
        tier: 2,
        isSystemRole: true,
        isSuperadminRole: false,
        permissions: ROLE_PERMISSIONS[ROLES.EDITOR] || [],
      },
      {
        slug: "admin",
        name: "Admin",
        description: "Operations administrator with marketplace management authority",
        tier: 3,
        isSystemRole: true,
        isSuperadminRole: false,
        permissions: ROLE_PERMISSIONS[ROLES.ADMIN] || [],
      },
      {
        slug: "manager",
        name: "Manager",
        description: "Fulfillment, inventory, and operations manager",
        tier: 4,
        isSystemRole: true,
        isSuperadminRole: false,
        permissions: ROLE_PERMISSIONS[ROLES.MANAGER] || [
          "inventory.view",
          "inventory.adjust",
          "inventory.transfer",
          "warehouses.view",
          "orders.view",
          "shipping.view",
          "tasks.view",
          "tasks.create",
          "tasks.assign",
        ],
      },
      {
        slug: "staff",
        name: "Staff",
        description: "General marketplace operational staff and support",
        tier: 5,
        isSystemRole: true,
        isSuperadminRole: false,
        permissions: [
          "dashboard.view",
          "support.view",
          "support.respond",
          "tasks.view",
        ],
      },
    ];

    const jobRoleDocs = {};
    for (const jr of initialJobRoles) {
      let jobRoleDoc = await JobRole.findOne({ slug: jr.slug });
      if (!jobRoleDoc) {
        jobRoleDoc = await JobRole.create({
          name: jr.name,
          slug: jr.slug,
          description: jr.description,
          tier: jr.tier,
          permissions: jr.permissions,
          isSystemRole: jr.isSystemRole,
          isSuperadminRole: jr.isSuperadminRole,
          isActive: true,
        });
      }
      jobRoleDocs[jr.slug] = jobRoleDoc;
    }

    // Configure Initial Database-Backed Management Scope
    if (jobRoleDocs.superadmin && (!jobRoleDocs.superadmin.managementScope || jobRoleDocs.superadmin.managementScope.length === 0)) {
      jobRoleDocs.superadmin.managementScope = [
        jobRoleDocs.editor._id,
        jobRoleDocs.admin._id,
        jobRoleDocs.manager._id,
        jobRoleDocs.staff._id,
      ];
      await jobRoleDocs.superadmin.save();
    }

    if (jobRoleDocs.editor && (!jobRoleDocs.editor.managementScope || jobRoleDocs.editor.managementScope.length === 0)) {
      jobRoleDocs.editor.managementScope = [
        jobRoleDocs.admin._id,
        jobRoleDocs.manager._id,
        jobRoleDocs.staff._id,
      ];
      await jobRoleDocs.editor.save();
    }

    if (jobRoleDocs.admin && (!jobRoleDocs.admin.managementScope || jobRoleDocs.admin.managementScope.length === 0)) {
      jobRoleDocs.admin.managementScope = [
        jobRoleDocs.manager._id,
        jobRoleDocs.staff._id,
      ];
      await jobRoleDocs.admin.save();
    }

    if (jobRoleDocs.manager && (!jobRoleDocs.manager.managementScope || jobRoleDocs.manager.managementScope.length === 0)) {
      jobRoleDocs.manager.managementScope = [jobRoleDocs.staff._id];
      await jobRoleDocs.manager.save();
    }

    // Link Superadmin employee to superadmin JobRole
    if (employeeDoc && jobRoleDocs.superadmin && !employeeDoc.jobRoleId) {
      employeeDoc.jobRoleId = jobRoleDocs.superadmin._id;
      await employeeDoc.save();
    }

    // Ensure any existing employees without jobRoleId get linked to their corresponding JobRole
    const unlinkedEmployees = await Employee.find({ jobRoleId: null });
    for (const emp of unlinkedEmployees) {
      const u = await User.findById(emp.userId).lean();
      if (!u) continue;
      if (u.role === "super_admin" && jobRoleDocs.superadmin) {
        emp.jobRoleId = jobRoleDocs.superadmin._id;
        await emp.save();
      } else if (u.role === "editor" && jobRoleDocs.editor) {
        emp.jobRoleId = jobRoleDocs.editor._id;
        await emp.save();
      } else if (u.role === "admin" && jobRoleDocs.admin) {
        emp.jobRoleId = jobRoleDocs.admin._id;
        await emp.save();
      } else if (u.role === "manager" && jobRoleDocs.manager) {
        emp.jobRoleId = jobRoleDocs.manager._id;
        await emp.save();
      } else if (jobRoleDocs.staff) {
        emp.jobRoleId = jobRoleDocs.staff._id;
        await emp.save();
      }
    }

    logger.info("Privileged bootstrap initialization completed successfully");
    return { success: true };
  } catch (error) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Privileged bootstrap initialization failed"
    );
    throw error;
  }
};

module.exports = {
  bootstrapSuperadmin,
};
