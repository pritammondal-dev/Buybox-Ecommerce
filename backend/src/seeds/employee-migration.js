const crypto = require("crypto");
const User = require("../models/User");
const Role = require("../models/Role");
const Employee = require("../models/Employee");
const EmployeeRole = require("../models/EmployeeRole");

const ROLE_MAPPING = {
  support: {
    systemRoleSlug: "system_support",
    department: "Customer Support",
    jobTitle: "Support Specialist",
  },
  manager: {
    systemRoleSlug: "system_manager",
    department: "Operations",
    jobTitle: "Operations Manager",
  },
  admin: {
    systemRoleSlug: "system_admin",
    department: "Administration",
    jobTitle: "Platform Administrator",
  },
  super_admin: {
    systemRoleSlug: "system_super_admin",
    department: "Governance",
    jobTitle: "Super Administrator",
  },
};

/**
 * Generate a deterministic, collision-resistant employee number from User ObjectId.
 * Running migration multiple times on the same User yields the identical identifier.
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @returns {string} e.g. "EMP-A1B2C3D4"
 */
const generateDeterministicEmployeeNumber = (userId) => {
  const hash = crypto
    .createHash("sha256")
    .update(userId.toString())
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `EMP-${hash}`;
};

/**
 * Migrate existing staff/admin users to the normalized Employee and EmployeeRole models.
 *
 * Invariants:
 * - Customers and Vendors do NOT get Employee records.
 * - User records and User.role are NEVER modified or deleted.
 * - Idempotent: safe to run multiple times without duplicating records.
 *
 * @returns {Promise<{ usersExamined: number, employeesCreated: number, rolesAssigned: number }>}
 */
const migrateEmployees = async () => {
  const privilegedRoles = Object.keys(ROLE_MAPPING);

  // Find all users with privileged roles
  const users = await User.find({
    role: { $in: privilegedRoles },
  });

  let employeesCreated = 0;
  let rolesAssigned = 0;

  for (const user of users) {
    const mapping = ROLE_MAPPING[user.role];
    if (!mapping) continue;

    // 1. Resolve or create Employee profile
    let employee = await Employee.findOne({ userId: user._id });

    if (!employee) {
      const employeeNumber = generateDeterministicEmployeeNumber(user._id);

      employee = await Employee.create({
        userId: user._id,
        employeeNumber,
        department: mapping.department,
        jobTitle: mapping.jobTitle,
        status: user.isActive ? "active" : "suspended",
        activatedAt: user.createdAt || new Date(),
      });
      employeesCreated += 1;
    }

    // 2. Resolve corresponding system role
    const systemRole = await Role.findOne({ slug: mapping.systemRoleSlug });
    if (systemRole) {
      // 3. Upsert EmployeeRole assignment
      const existingAssignment = await EmployeeRole.findOne({
        employeeId: employee._id,
        roleId: systemRole._id,
      });

      if (!existingAssignment) {
        await EmployeeRole.create({
          employeeId: employee._id,
          roleId: systemRole._id,
          isActive: employee.status === "active",
          assignedAt: new Date(),
        });
        rolesAssigned += 1;
      }
    }
  }

  return {
    usersExamined: users.length,
    employeesCreated,
    rolesAssigned,
  };
};

module.exports = {
  ROLE_MAPPING,
  generateDeterministicEmployeeNumber,
  migrateEmployees,
};
