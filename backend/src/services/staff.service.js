const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Role = require("../models/Role");
const JobRole = require("../models/JobRole");
const EmployeeRole = require("../models/EmployeeRole");
const Task = require("../models/Task");
const AppError = require("../errors/AppError");
const { hashPassword } = require("../utils/password");
const { ROLES } = require("../constants/auth.constants");
const {
  recordAuditLog,
  sanitizeAuditState,
} = require("./governance.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
  getEffectivePermissions,
} = require("./authorization.service");
const {
  canAssignRole,
  canManageEmployee,
} = require("./job-role-authority.service");

/**
 * List staff members with role, employee profile, and metadata.
 */
const listStaff = async (query = {}) => {
  const { page = 1, limit = 20, role, status, search } = query;

  // Build match query for User
  const userFilter = {
    role: { $in: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR] },
  };

  if (role) {
    userFilter.role = role;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    userFilter.$or = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
    ];
  }

  const users = await User.find(userFilter)
    .select("-password")
    .sort({ createdAt: -1 })
    .lean();

  const userIds = users.map((u) => u._id);

  // Find corresponding Employee profiles
  const employeeFilter = { userId: { $in: userIds } };
  if (status) {
    employeeFilter.status = status;
  }

  const employees = await Employee.find(employeeFilter)
    .populate("jobRoleId", "name slug tier isActive isSystemRole")
    .lean();
  const employeeMap = new Map();
  for (const emp of employees) {
    employeeMap.set(emp.userId.toString(), emp);
  }

  // Filter users that match the employee filter (if status was specified)
  const matchedUsers = users.filter((u) => {
    if (!status) return true;
    const emp = employeeMap.get(u._id.toString());
    return emp && emp.status === status;
  });

  const total = matchedUsers.length;
  const skip = (Number(page) - 1) * Number(limit);
  const paginatedUsers = matchedUsers.slice(skip, skip + Number(limit));

  // Enrich with active task count and effective permissions count
  const staffList = await Promise.all(
    paginatedUsers.map(async (u) => {
      const emp = employeeMap.get(u._id.toString()) || null;
      const [taskCount, permissions] = await Promise.all([
        Task.countDocuments({ assignedTo: u._id, status: { $ne: "COMPLETED" } }),
        getEffectivePermissions(u._id),
      ]);

      return {
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        employee: emp
          ? {
              id: emp._id,
              employeeNumber: emp.employeeNumber,
              jobTitle: emp.jobTitle,
              department: emp.department,
              status: emp.status,
              jobRoleId: emp.jobRoleId?._id || emp.jobRoleId || null,
              jobRole: emp.jobRoleId && typeof emp.jobRoleId === "object"
                ? {
                    id: emp.jobRoleId._id,
                    name: emp.jobRoleId.name,
                    slug: emp.jobRoleId.slug,
                    tier: emp.jobRoleId.tier,
                  }
                : null,
            }
          : null,
        activeTasksCount: taskCount,
        permissionsCount: permissions.length,
      };
    })
  );

  return {
    staff: staffList,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

/**
 * Get staff details by ID.
 */
const getStaffById = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError("Invalid user ID", 400, "INVALID_USER_ID");
  }

  const user = await User.findById(userId).select("-password").lean();
  if (!user || ![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR].includes(user.role)) {
    throw new AppError("Staff member not found", 404, "STAFF_NOT_FOUND");
  }

  const [employee, permissions, activeTasks] = await Promise.all([
    Employee.findOne({ userId: user._id })
      .populate("jobRoleId", "name slug tier permissions managementScope isActive isSystemRole")
      .lean(),
    getEffectivePermissions(user._id),
    Task.find({ assignedTo: user._id })
      .select("title status priority dueDate createdAt")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    employee: employee
      ? {
          id: employee._id,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department,
          status: employee.status,
          jobRoleId: employee.jobRoleId?._id || employee.jobRoleId || null,
          jobRole: employee.jobRoleId && typeof employee.jobRoleId === "object"
            ? {
                id: employee.jobRoleId._id,
                name: employee.jobRoleId.name,
                slug: employee.jobRoleId.slug,
                tier: employee.jobRoleId.tier,
                permissions: employee.jobRoleId.permissions,
                managementScope: employee.jobRoleId.managementScope,
              }
            : null,
        }
      : null,
    permissions,
    activeTasks,
  };
};

/**
 * Create a new staff account (Admin or Editor).
 * Strictly requires Superadmin authorization.
 */
const createStaff = async (payload, actor, req = null) => {
  const { email, password, firstName, lastName, phone, role, jobTitle, department, jobRoleId } =
    payload;

  // Cannot create super_admin via staff provisioning API
  if (role === ROLES.SUPER_ADMIN || role === "super_admin") {
    throw new AppError(
      "Superadmin accounts cannot be created via standard staff provisioning",
      400,
      "CANNOT_CREATE_SUPERADMIN"
    );
  }

  // Resolve target JobRole
  let targetJobRole = null;
  if (jobRoleId) {
    targetJobRole = await JobRole.findById(jobRoleId);
  } else if (role) {
    targetJobRole = await JobRole.findOne({ slug: role.toLowerCase() });
  }

  // Two-Layer Authorization check: Superadmin or higher-tier manager with assign_role
  const isSuperadminActor = actor && actor.role === ROLES.SUPER_ADMIN;
  if (!isSuperadminActor) {
    if (!targetJobRole) {
      throw new AppError(
        "Only Superadmin can create privileged staff accounts",
        403,
        "FORBIDDEN"
      );
    }
    const authEval = await canAssignRole(actor, targetJobRole._id);
    if (!authEval.allowed) {
      throw new AppError(
        `Staff creation unauthorized: ${authEval.reason}`,
        403,
        "FORBIDDEN"
      );
    }
  }

  // Role injection check: Cannot create invalid roles
  if (role && ![ROLES.ADMIN, ROLES.EDITOR, ROLES.MANAGER, ROLES.SUPPORT, "admin", "editor", "manager", "support", "staff"].includes(role)) {
    throw new AppError(
      "Staff account role must be either admin or editor",
      400,
      "INVALID_STAFF_ROLE"
    );
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    throw new AppError("Email is already registered", 409, "EMAIL_EXISTS");
  }

  const hashedPassword = await hashPassword(password);

  const newUser = await User.create({
    email: normalizedEmail,
    password: hashedPassword,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone?.trim() || undefined,
    role: role || (targetJobRole ? (targetJobRole.slug.includes("editor") ? "editor" : "admin") : "staff"),
    isActive: true,
    isEmailVerified: true,
  });

  const empSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const employeeNumber = `EMP-${(role || "STAFF").toUpperCase()}-${empSuffix}`;

  const actorId = actor?._id || actor?.id;

  const employee = await Employee.create({
    userId: newUser._id,
    employeeNumber,
    jobTitle: jobTitle || (role === ROLES.ADMIN ? "Marketplace Administrator" : "Catalog Editor"),
    department: department || (role === ROLES.ADMIN ? "Operations" : "Catalog & Content"),
    status: "active",
    invitedBy: actorId,
    activatedAt: new Date(),
    jobRoleId: targetJobRole ? targetJobRole._id : null,
  });

  // Assign system role for backward compatibility
  const roleDoc = await Role.findOne({ slug: role });
  if (roleDoc) {
    await EmployeeRole.create({
      employeeId: employee._id,
      roleId: roleDoc._id,
      assignedBy: actorId,
      isActive: true,
    });
  }

  await recordAuditLog({
    actorId,
    targetId: newUser._id,
    action: "staff.created",
    entityType: "staff",
    afterState: sanitizeAuditState({
      userId: newUser._id,
      email: newUser.email,
      role: newUser.role,
      employeeNumber,
      jobTitle: employee.jobTitle,
    }),
    req,
  });

  return {
    id: newUser._id,
    _id: newUser._id,
    email: newUser.email,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    role: newUser.role,
    employee: {
      id: employee._id,
      _id: employee._id,
      employeeNumber: employee.employeeNumber,
      jobTitle: employee.jobTitle,
      department: employee.department,
      status: employee.status,
      jobRoleId: employee.jobRoleId || null,
      jobRole: targetJobRole
        ? {
            id: targetJobRole._id,
            name: targetJobRole.name,
            slug: targetJobRole.slug,
            tier: targetJobRole.tier,
          }
        : null,
    },
  };
};

/**
 * Update staff details.
 */
const updateStaff = async (userId, payload, actor, req = null) => {
  if (!actor || actor.role !== ROLES.SUPER_ADMIN) {
    throw new AppError(
      "Only Superadmin can update staff profiles",
      403,
      "FORBIDDEN"
    );
  }

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError("Invalid user ID", 400, "INVALID_USER_ID");
  }

  const user = await User.findById(userId);
  if (!user || ![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR].includes(user.role)) {
    throw new AppError("Staff member not found", 404, "STAFF_NOT_FOUND");
  }

  const employee = await Employee.findOne({ userId: user._id });
  const beforeState = sanitizeAuditState({
    user: user.toObject(),
    employee: employee ? employee.toObject() : null,
  });

  if (user.role === ROLES.SUPER_ADMIN && payload.role && payload.role !== ROLES.SUPER_ADMIN) {
    throw new AppError("Superadmin accounts cannot be downgraded", 400, "CANNOT_DOWNGRADE_SUPERADMIN");
  }

  if (payload.role && [ROLES.ADMIN, ROLES.EDITOR].includes(payload.role) && user.role !== ROLES.SUPER_ADMIN) {
    user.role = payload.role;
  }

  if (payload.firstName !== undefined) user.firstName = payload.firstName;
  if (payload.lastName !== undefined) user.lastName = payload.lastName;
  if (payload.phone !== undefined) user.phone = payload.phone?.trim() || undefined;\n  if (payload.phone !== undefined) user.phone = payload.phone?.trim() || undefined;
  await user.save();

  if (employee) {
    if (payload.jobTitle !== undefined) employee.jobTitle = payload.jobTitle;
    if (payload.department !== undefined) employee.department = payload.department;
    if (payload.status !== undefined) {
      if (user.role === ROLES.SUPER_ADMIN && payload.status === "suspended") {
        throw new AppError("Superadmin accounts cannot be suspended", 400, "CANNOT_SUSPEND_SUPERADMIN");
      }
      employee.status = payload.status;
      user.isActive = payload.status === "active";
      await user.save();
    }
    await employee.save();
  }

  await incrementPermissionVersion(user._id);

  const actorId = actor?._id || actor?.id;

  await recordAuditLog({
    actorId,
    targetId: user._id,
    action: "staff.updated",
    entityType: "staff",
    beforeState,
    afterState: sanitizeAuditState({
      user: user.toObject(),
      employee: employee ? employee.toObject() : null,
    }),
    req,
  });

  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    employee: employee
      ? {
          id: employee._id,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department,
          status: employee.status,
        }
      : null,
  };
};

/**
 * Suspend staff member.
 */
const suspendStaff = async (userId, actor, req = null) => {
  if (!actor || actor.role !== ROLES.SUPER_ADMIN) {
    throw new AppError("Only Superadmin can suspend staff", 403, "FORBIDDEN");
  }

  const actorId = actor?._id || actor?.id;

  let user = await User.findById(userId);
  if (!user) {
    const emp = await Employee.findById(userId);
    if (emp) {
      user = await User.findById(emp.userId);
    }
  }
  if (!user) {
    throw new AppError("Staff member not found", 404, "STAFF_NOT_FOUND");
  }

  if (user.role === ROLES.SUPER_ADMIN) {
    throw new AppError("Superadmin accounts cannot be suspended", 400, "CANNOT_SUSPEND_SUPERADMIN");
  }

  user.isActive = false;
  await user.save();

  const employee = await Employee.findOne({ userId: user._id });
  if (employee) {
    employee.status = "suspended";
    await employee.save();
  }

  // Immediately revoke tokens and cached authorization
  await incrementAuthVersion(user._id);
  await incrementPermissionVersion(user._id);

  await recordAuditLog({
    actorId,
    targetId: user._id,
    action: "staff.suspended",
    entityType: "staff",
    afterState: { userId: user._id, status: "suspended" },
    req,
  });

  return { success: true, message: "Staff member suspended successfully", employee };
};

/**
 * Reactivate suspended staff member.
 */
const reactivateStaff = async (userId, actor, req = null) => {
  if (!actor || actor.role !== ROLES.SUPER_ADMIN) {
    throw new AppError("Only Superadmin can reactivate staff", 403, "FORBIDDEN");
  }

  const actorId = actor?._id || actor?.id;

  let user = await User.findById(userId);
  if (!user) {
    const emp = await Employee.findById(userId);
    if (emp) {
      user = await User.findById(emp.userId);
    }
  }
  if (!user) {
    throw new AppError("Staff member not found", 404, "STAFF_NOT_FOUND");
  }

  user.isActive = true;
  await user.save();

  const employee = await Employee.findOne({ userId: user._id });
  if (employee) {
    employee.status = "active";
    await employee.save();
  }

  await incrementPermissionVersion(user._id);

  await recordAuditLog({
    actorId,
    targetId: user._id,
    action: "staff.reactivated",
    entityType: "staff",
    afterState: { userId: user._id, status: "active" },
    req,
  });

  return { success: true, message: "Staff member reactivated successfully", employee };
};

/**
 * Reset staff password securely.
 */
const resetStaffPassword = async (userId, newPassword, actor, req = null) => {
  if (!actor || actor.role !== ROLES.SUPER_ADMIN) {
    throw new AppError("Only Superadmin can reset staff passwords", 403, "FORBIDDEN");
  }

  const actorId = actor?._id || actor?.id;

  let user = await User.findById(userId);
  if (!user) {
    const emp = await Employee.findById(userId);
    if (emp) {
      user = await User.findById(emp.userId);
    }
  }
  if (!user) {
    throw new AppError("Staff member not found", 404, "STAFF_NOT_FOUND");
  }

  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;
  await user.save();

  await incrementAuthVersion(user._id);

  await recordAuditLog({
    actorId,
    targetId: user._id,
    action: "staff.password_reset",
    entityType: "staff",
    afterState: { userId: user._id, resetAt: new Date() },
    req,
  });

  // Invalidate any active sessions
  await incrementAuthVersion(user._id);

  await recordAuditLog({
    actorId: actor._id,
    targetId: user._id,
    action: "staff.password_reset",
    entityType: "staff",
    afterState: { userId: user._id, passwordChanged: true },
    req,
  });

  return { success: true, message: "Staff password reset successfully" };
};

const revokeStaffSessions = async (userId, actor, req = null) => {
  const actorId = actor?._id || actor?.id;
  const isSuperadmin = actor?.role === ROLES.SUPER_ADMIN || actor?.role === "super_admin";

  let user = await User.findById(userId);
  if (!user) {
    const emp = await Employee.findById(userId);
    if (emp) {
      user = await User.findById(emp.userId);
    }
  }
  if (!user) {
    throw new AppError("Staff member not found", 404, "STAFF_NOT_FOUND");
  }

  if (user.role === ROLES.SUPER_ADMIN || user.role === "super_admin") {
    if (!isSuperadmin) {
      throw new AppError("Cannot revoke Superadmin sessions", 403, "FORBIDDEN");
    }
  }

  const { authVersion } = await incrementAuthVersion(user._id);

  await recordAuditLog({
    actorId,
    targetId: user._id,
    action: "staff.sessions_revoked",
    entityType: "staff",
    afterState: { userId: user._id, authVersion, revokedAt: new Date() },
    req,
  });

  return {
    success: true,
    message: "All active sessions for this staff member have been revoked",
    authVersion,
  };
};

const getStaffSessions = async (userId) => {
  let user = await User.findById(userId).select("-password").lean();
  if (!user) {
    const emp = await Employee.findById(userId).lean();
    if (emp) {
      user = await User.findById(emp.userId).select("-password").lean();
    }
  }
  if (!user) {
    throw new AppError("Staff member not found", 404, "STAFF_NOT_FOUND");
  }

  return {
    userId: user._id,
    authVersion: user.authVersion || 1,
    permissionVersion: user.permissionVersion || 1,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt || null,
  };
};

module.exports = {
  listStaff,
  getStaffById,
  createStaff,
  updateStaff,
  suspendStaff,
  reactivateStaff,
  resetStaffPassword,
  revokeStaffSessions,
  getStaffSessions,
};
