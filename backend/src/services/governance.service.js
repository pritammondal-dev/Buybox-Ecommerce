const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const RolePermission = require("../models/RolePermission");
const EmployeeRole = require("../models/EmployeeRole");
const EmployeePermissionGrant = require("../models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../models/EmployeePermissionRestriction");
const WorkAssignment = require("../models/WorkAssignment");
const AuditLog = require("../models/AuditLog");
const Vendor = require("../models/Vendor");
const Warehouse = require("../models/Warehouse");
const Category = require("../models/Category");
const withTransaction = require("../utils/withTransaction");
const AppError = require("../errors/AppError");
const {
  SCOPE_TYPES,
  ALLOWED_SCOPE_TYPES,
} = require("../constants/scope.constants");
const {
  SUPPORT_TICKET_CATEGORIES,
} = require("../constants/support.constants");

/**
 * Deep clone and remove sensitive credentials from state before storing in AuditLog.
 *
 * @param {Object} state
 * @returns {Object|null}
 */
const sanitizeAuditState = (state) => {
  if (!state || typeof state !== "object") {
    return state;
  }

  const SENSITIVE_KEYS = [
    "password",
    "passwordHash",
    "refreshToken",
    "token",
    "secret",
    "secretKey",
    "accessToken",
    "otp",
    "verificationToken",
  ];

  try {
    const raw = typeof state.toObject === "function" ? state.toObject() : state;
    const cloned = JSON.parse(JSON.stringify(raw));

    const scrub = (obj) => {
      if (!obj || typeof obj !== "object") return;
      for (const key of Object.keys(obj)) {
        if (SENSITIVE_KEYS.includes(key)) {
          delete obj[key];
        } else if (typeof obj[key] === "object") {
          scrub(obj[key]);
        }
      }
    };

    scrub(cloned);
    return cloned;
  } catch (err) {
    return null;
  }
};

/**
 * Record an append-only AuditLog inside an optional MongoDB transaction session.
 *
 * @param {Object} params
 * @param {import("mongoose").Types.ObjectId|string} params.actorId
 * @param {import("mongoose").Types.ObjectId|string} [params.targetId]
 * @param {string} params.action
 * @param {string} params.entityType
 * @param {Object} [params.beforeState]
 * @param {Object} [params.afterState]
 * @param {Object} [params.req] Express request for IP & User Agent
 * @param {import("mongoose").ClientSession} [params.session]
 * @returns {Promise<Object>}
 */
const recordAuditLog = async ({
  actorId,
  targetId = null,
  action,
  entityType,
  beforeState = null,
  afterState = null,
  req = null,
  session = null,
}) => {
  let ipAddress = null;
  let userAgent = null;

  if (req) {
    ipAddress =
      req.ip ||
      (req.headers && req.headers["x-forwarded-for"]
        ? req.headers["x-forwarded-for"].split(",")[0].trim()
        : null) ||
      req.socket?.remoteAddress ||
      null;
    userAgent = (req.headers && req.headers["user-agent"]) || null;
  }

  const logData = {
    actorId,
    targetId: targetId ? new mongoose.Types.ObjectId(targetId) : null,
    action,
    entityType,
    beforeState: sanitizeAuditState(beforeState),
    afterState: sanitizeAuditState(afterState),
    ipAddress,
    userAgent,
    createdAt: new Date(),
  };

  if (session) {
    const [log] = await AuditLog.create([logData], { session });
    return log;
  }

  return AuditLog.create(logData);
};

/**
 * Count active Super Admins in the system across legacy role and dynamic role mappings.
 *
 * @param {import("mongoose").ClientSession} [session]
 * @returns {Promise<number>}
 */
const countActiveSuperAdmins = async (session = null) => {
  const superAdminUserIds = new Set();

  // 1. Users with legacy role 'super_admin' who are active
  const legacyQuery = User.find({ role: "super_admin", isActive: true }).select(
    "_id",
  );
  if (session) legacyQuery.session(session);
  const legacySuperAdmins = await legacyQuery.lean();

  for (const u of legacySuperAdmins) {
    superAdminUserIds.add(u._id.toString());
  }

  // 2. Active employees with dynamic system_super_admin role
  const roleQuery = Role.findOne({ slug: "system_super_admin" });
  if (session) roleQuery.session(session);
  const superAdminRole = await roleQuery.lean();

  if (superAdminRole) {
    const now = new Date();
    const erQuery = EmployeeRole.find({
      roleId: superAdminRole._id,
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
    if (session) erQuery.session(session);
    const activeEmployeeRoles = await erQuery.lean();

    if (activeEmployeeRoles.length > 0) {
      const empIds = activeEmployeeRoles.map((er) => er.employeeId);
      const empQuery = Employee.find({
        _id: { $in: empIds },
        status: "active",
      }).select("userId");
      if (session) empQuery.session(session);
      const activeEmployees = await empQuery.lean();

      if (activeEmployees.length > 0) {
        const userIds = activeEmployees.map((e) => e.userId);
        const userQuery = User.find({
          _id: { $in: userIds },
          isActive: true,
        }).select("_id");
        if (session) userQuery.session(session);
        const activeUsers = await userQuery.lean();

        for (const u of activeUsers) {
          superAdminUserIds.add(u._id.toString());
        }
      }
    }
  }

  return superAdminUserIds.size;
};

/**
 * Assert that modifying or deactivating the target does NOT destroy the final active Super Admin.
 *
 * @param {Object} params
 * @param {string|import("mongoose").Types.ObjectId} params.targetUserId
 * @param {import("mongoose").ClientSession} [params.session]
 */
const assertNotFinalSuperAdmin = async ({ targetUserId, session = null }) => {
  if (!targetUserId) return;

  const targetUser = await User.findById(targetUserId).session(session).lean();
  if (!targetUser) return;

  // Check if target is currently an active super admin
  let isTargetSuperAdmin = targetUser.role === "super_admin" && targetUser.isActive;

  if (!isTargetSuperAdmin) {
    const superAdminRole = await Role.findOne({ slug: "system_super_admin" })
      .session(session)
      .lean();
    if (superAdminRole) {
      const emp = await Employee.findOne({ userId: targetUser._id, status: "active" })
        .session(session)
        .lean();
      if (emp) {
        const hasRole = await EmployeeRole.exists({
          employeeId: emp._id,
          roleId: superAdminRole._id,
          isActive: true,
        }).session(session);
        if (hasRole) {
          isTargetSuperAdmin = true;
        }
      }
    }
  }

  if (isTargetSuperAdmin) {
    const totalActive = await countActiveSuperAdmins(session);
    if (totalActive <= 1) {
      throw new AppError(
        "Cannot deactivate or revoke privileges from the final active Super Admin",
        400,
        "CANNOT_MODIFY_FINAL_SUPER_ADMIN",
      );
    }
  }
};

/* =========================================================================
   1. ROLE GOVERNANCE
   ========================================================================= */

const listRoles = async ({ page = 1, limit = 50, search, isActive }) => {
  const query = {};
  if (isActive !== undefined) {
    query.isActive = isActive === "true" || isActive === true;
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [roles, total] = await Promise.all([
    Role.find(query).sort({ isSystem: -1, name: 1 }).skip(skip).limit(Number(limit)).lean(),
    Role.countDocuments(query),
  ]);

  return { roles, total, page: Number(page), limit: Number(limit) };
};

const getRoleById = async (roleId) => {
  if (!mongoose.isValidObjectId(roleId)) {
    throw new AppError("Invalid role ID", 400, "INVALID_ROLE_ID");
  }

  const role = await Role.findById(roleId).lean();
  if (!role) {
    throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
  }

  const mappings = await RolePermission.find({ roleId: role._id })
    .populate("permissionId")
    .lean();

  const permissions = mappings
    .filter((m) => m.permissionId && m.permissionId.isActive)
    .map((m) => m.permissionId);

  return { ...role, permissions };
};

const createRole = async (data, actorContext, req) => {
  const { name, slug, description, isSystem = false } = data;

  return withTransaction(async (session) => {
    const existing = await Role.findOne({
      $or: [{ slug: slug.toLowerCase() }, { name: name.trim() }],
    }).session(session);

    if (existing) {
      throw new AppError(
        "A role with this name or slug already exists",
        409,
        "ROLE_ALREADY_EXISTS",
      );
    }

    const [role] = await Role.create(
      [
        {
          name: name.trim(),
          slug: slug.toLowerCase().trim(),
          description: description ? description.trim() : null,
          isSystem,
          isActive: true,
        },
      ],
      { session },
    );

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: role._id,
      action: "ROLE_CREATE",
      entityType: "Role",
      beforeState: null,
      afterState: role,
      req,
      session,
    });

    return role;
  });
};

const updateRole = async (roleId, data, actorContext, req) => {
  if (!mongoose.isValidObjectId(roleId)) {
    throw new AppError("Invalid role ID", 400, "INVALID_ROLE_ID");
  }

  return withTransaction(async (session) => {
    const role = await Role.findById(roleId).session(session);
    if (!role) {
      throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
    }

    const beforeState = role.toObject();

    // System role protection invariants
    if (role.isSystem) {
      if (data.slug && data.slug.toLowerCase().trim() !== role.slug) {
        throw new AppError(
          "System role slug cannot be modified",
          400,
          "SYSTEM_ROLE_IMMUTABLE",
        );
      }
      if (
        ["system_super_admin", "system_admin"].includes(role.slug) &&
        data.isActive === false
      ) {
        throw new AppError(
          "Core system roles cannot be deactivated",
          400,
          "CANNOT_DEACTIVATE_CORE_SYSTEM_ROLE",
        );
      }
    }

    if (data.name && data.name.trim() !== role.name) {
      const duplicate = await Role.findOne({
        name: data.name.trim(),
        _id: { $ne: role._id },
      }).session(session);
      if (duplicate) {
        throw new AppError(
          "A role with this name already exists",
          409,
          "ROLE_NAME_DUPLICATE",
        );
      }
      role.name = data.name.trim();
    }

    if (data.description !== undefined) {
      role.description = data.description ? data.description.trim() : null;
    }

    let statusDeactivated = false;
    if (data.isActive !== undefined && data.isActive !== role.isActive) {
      role.isActive = data.isActive;
      if (data.isActive === false) {
        statusDeactivated = true;
      }
    }

    await role.save({ session });

    // When a role is deactivated, invalidate permissionVersion for all active employees assigned this role
    if (statusDeactivated) {
      const activeEmployeeRoles = await EmployeeRole.find({
        roleId: role._id,
        isActive: true,
      }).session(session);

      if (activeEmployeeRoles.length > 0) {
        const empIds = activeEmployeeRoles.map((er) => er.employeeId);
        const employees = await Employee.find({ _id: { $in: empIds } })
          .session(session)
          .select("userId");
        const userIds = employees.map((e) => e.userId);

        if (userIds.length > 0) {
          await User.updateMany(
            { _id: { $in: userIds } },
            { $inc: { permissionVersion: 1 } },
          ).session(session);
        }
      }
    }

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: role._id,
      action: "ROLE_UPDATE",
      entityType: "Role",
      beforeState,
      afterState: role,
      req,
      session,
    });

    return role;
  });
};

const updateRolePermissions = async (
  roleId,
  permissionIds = [],
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(roleId)) {
    throw new AppError("Invalid role ID", 400, "INVALID_ROLE_ID");
  }

  return withTransaction(async (session) => {
    const role = await Role.findById(roleId).session(session);
    if (!role) {
      throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
    }

    // Verify all permissionIds exist and are active
    const cleanIds = [...new Set(permissionIds.map((id) => String(id).trim()))];
    const validPermissions = await Permission.find({
      _id: { $in: cleanIds },
      isActive: true,
    })
      .session(session)
      .lean();

    if (validPermissions.length !== cleanIds.length) {
      throw new AppError(
        "One or more specified permissions do not exist or are inactive",
        400,
        "INVALID_PERMISSIONS_SPECIFIED",
      );
    }

    // Capture before state
    const beforeMappings = await RolePermission.find({ roleId: role._id })
      .session(session)
      .lean();

    // Remove existing mappings
    await RolePermission.deleteMany({ roleId: role._id }).session(session);

    // Insert new mappings
    const newMappings = cleanIds.map((pId) => ({
      roleId: role._id,
      permissionId: new mongoose.Types.ObjectId(pId),
      grantedBy: new mongoose.Types.ObjectId(actorContext.id),
    }));

    if (newMappings.length > 0) {
      await RolePermission.insertMany(newMappings, { session });
    }

    // Role Permission Change Propagation:
    // Invalidate permissionVersion for all active employees assigned this role
    const activeEmployeeRoles = await EmployeeRole.find({
      roleId: role._id,
      isActive: true,
    }).session(session);

    if (activeEmployeeRoles.length > 0) {
      const empIds = activeEmployeeRoles.map((er) => er.employeeId);
      const employees = await Employee.find({ _id: { $in: empIds } })
        .session(session)
        .select("userId");
      const userIds = employees.map((e) => e.userId);

      if (userIds.length > 0) {
        await User.updateMany(
          { _id: { $in: userIds } },
          { $inc: { permissionVersion: 1 } },
        ).session(session);
      }
    }

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: role._id,
      action: "ROLE_PERMISSIONS_UPDATE",
      entityType: "RolePermission",
      beforeState: { permissionIds: beforeMappings.map((m) => m.permissionId.toString()) },
      afterState: { permissionIds: cleanIds },
      req,
      session,
    });

    return {
      roleId: role._id,
      roleName: role.name,
      permissions: validPermissions,
    };
  });
};

/* =========================================================================
   2. PERMISSION GOVERNANCE (READ-ONLY)
   ========================================================================= */

const listPermissions = async ({ page = 1, limit = 100, module, search }) => {
  const query = {};
  if (module) {
    query.module = String(module).toLowerCase().trim();
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [permissions, total] = await Promise.all([
    Permission.find(query)
      .sort({ module: 1, slug: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Permission.countDocuments(query),
  ]);

  return { permissions, total, page: Number(page), limit: Number(limit) };
};

const getPermissionById = async (permissionId) => {
  if (!mongoose.isValidObjectId(permissionId)) {
    throw new AppError("Invalid permission ID", 400, "INVALID_PERMISSION_ID");
  }

  const permission = await Permission.findById(permissionId).lean();
  if (!permission) {
    throw new AppError("Permission not found", 404, "PERMISSION_NOT_FOUND");
  }

  return permission;
};

/* =========================================================================
   3. EMPLOYEE GOVERNANCE
   ========================================================================= */

const listEmployees = async ({
  page = 1,
  limit = 20,
  status,
  department,
  search,
}) => {
  const query = {};
  if (status) {
    query.status = status;
  }
  if (department) {
    query.department = department;
  }
  if (search) {
    query.$or = [
      { employeeNumber: { $regex: search, $options: "i" } },
      { jobTitle: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [employees, total] = await Promise.all([
    Employee.find(query)
      .populate("userId", "firstName lastName email role isActive authVersion permissionVersion")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Employee.countDocuments(query),
  ]);

  return { employees, total, page: Number(page), limit: Number(limit) };
};

const getEmployeeById = async (employeeId) => {
  if (!mongoose.isValidObjectId(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  const employee = await Employee.findById(employeeId)
    .populate("userId", "firstName lastName email role isActive authVersion permissionVersion")
    .lean();

  if (!employee) {
    throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
  }

  const [roles, grants, restrictions, assignments] = await Promise.all([
    EmployeeRole.find({ employeeId: employee._id })
      .populate("roleId")
      .populate("assignedBy", "firstName lastName email")
      .lean(),
    EmployeePermissionGrant.find({ employeeId: employee._id })
      .populate("permissionId")
      .populate("grantedBy", "firstName lastName email")
      .lean(),
    EmployeePermissionRestriction.find({ employeeId: employee._id })
      .populate("permissionId")
      .populate("restrictedBy", "firstName lastName email")
      .lean(),
    WorkAssignment.find({ employeeId: employee._id })
      .populate("assignedBy", "firstName lastName email")
      .lean(),
  ]);

  return {
    ...employee,
    roles,
    grants,
    restrictions,
    assignments,
  };
};

const createEmployee = async (data, actorContext, req) => {
  const { userId, jobTitle, department, employeeNumber } = data;

  return withTransaction(async (session) => {
    // Validate User
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    if (user.isActive === false) {
      throw new AppError(
        "Cannot create employee profile for an inactive user",
        400,
        "USER_INACTIVE",
      );
    }

    // Strict actor boundary: cannot turn customer or vendor into employee without explicit role update
    if (["customer", "vendor"].includes(user.role)) {
      throw new AppError(
        "Cannot create employee profile for customer or vendor account without explicit role migration",
        400,
        "INVALID_USER_ROLE",
      );
    }

    // Check if user is already an employee
    const existingEmployee = await Employee.findOne({ userId: user._id }).session(session);
    if (existingEmployee) {
      throw new AppError(
        "An employee profile already exists for this user",
        409,
        "EMPLOYEE_ALREADY_EXISTS",
      );
    }

    // Generate unique employeeNumber if omitted
    let empNum = employeeNumber ? employeeNumber.toUpperCase().trim() : null;
    if (!empNum) {
      empNum = `EMP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    } else {
      const duplicateNum = await Employee.findOne({ employeeNumber: empNum }).session(session);
      if (duplicateNum) {
        throw new AppError(
          "Employee number is already in use",
          409,
          "EMPLOYEE_NUMBER_DUPLICATE",
        );
      }
    }

    const [employee] = await Employee.create(
      [
        {
          userId: user._id,
          employeeNumber: empNum,
          jobTitle: jobTitle ? jobTitle.trim() : null,
          department: department ? department.trim() : null,
          status: "active",
          invitedBy: new mongoose.Types.ObjectId(actorContext.id),
          activatedAt: new Date(),
        },
      ],
      { session },
    );

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: employee._id,
      action: "EMPLOYEE_CREATE",
      entityType: "Employee",
      beforeState: null,
      afterState: employee,
      req,
      session,
    });

    return employee;
  });
};

const updateEmployee = async (employeeId, data, actorContext, req) => {
  if (!mongoose.isValidObjectId(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  return withTransaction(async (session) => {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    const beforeState = employee.toObject();

    if (data.jobTitle !== undefined) {
      employee.jobTitle = data.jobTitle ? data.jobTitle.trim() : null;
    }
    if (data.department !== undefined) {
      employee.department = data.department ? data.department.trim() : null;
    }

    if (data.status && data.status !== employee.status) {
      // Super Admin Safeguard: if deactivating/suspending a Super Admin, verify at least 1 other active Super Admin remains
      if (["suspended", "terminated"].includes(data.status)) {
        await assertNotFinalSuperAdmin({
          targetUserId: employee.userId,
          session,
        });

        // Immediately invalidate existing sessions (authVersion) and permissions (permissionVersion)
        await User.findByIdAndUpdate(
          employee.userId,
          { $inc: { authVersion: 1, permissionVersion: 1 } },
          { session },
        );
      } else if (data.status === "active") {
        // Reactivating employee increments permissionVersion
        await User.findByIdAndUpdate(
          employee.userId,
          { $inc: { permissionVersion: 1 } },
          { session },
        );
      }

      employee.status = data.status;
    }

    await employee.save({ session });

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: employee._id,
      action: "EMPLOYEE_UPDATE",
      entityType: "Employee",
      beforeState,
      afterState: employee,
      req,
      session,
    });

    return employee;
  });
};

/* =========================================================================
   4. EMPLOYEE ROLE ASSIGNMENTS
   ========================================================================= */

const listEmployeeRoles = async (employeeId) => {
  if (!mongoose.isValidObjectId(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  return EmployeeRole.find({ employeeId })
    .populate("roleId")
    .populate("assignedBy", "firstName lastName email")
    .lean();
};

const assignEmployeeRole = async (
  employeeId,
  { roleId, expiresAt = null },
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(roleId)) {
    throw new AppError("Invalid ID provided", 400, "INVALID_IDENTIFIER");
  }

  return withTransaction(async (session) => {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (employee.status !== "active") {
      throw new AppError(
        "Cannot assign role to an inactive employee",
        400,
        "EMPLOYEE_NOT_ACTIVE",
      );
    }

    const role = await Role.findById(roleId).session(session);
    if (!role) {
      throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
    }
    if (!role.isActive) {
      throw new AppError(
        "Cannot assign an inactive role",
        400,
        "ROLE_NOT_ACTIVE",
      );
    }

    const existing = await EmployeeRole.findOne({
      employeeId: employee._id,
      roleId: role._id,
      isActive: true,
    }).session(session);

    if (existing) {
      throw new AppError(
        "Employee is already actively assigned this role",
        409,
        "ROLE_ALREADY_ASSIGNED",
      );
    }

    const [assignment] = await EmployeeRole.create(
      [
        {
          employeeId: employee._id,
          roleId: role._id,
          assignedBy: new mongoose.Types.ObjectId(actorContext.id),
          assignedAt: new Date(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isActive: true,
        },
      ],
      { session },
    );

    // Invalidate permissionVersion on employee user
    await User.findByIdAndUpdate(
      employee.userId,
      { $inc: { permissionVersion: 1 } },
      { session },
    );

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: assignment._id,
      action: "EMPLOYEE_ROLE_ASSIGN",
      entityType: "EmployeeRole",
      beforeState: null,
      afterState: assignment,
      req,
      session,
    });

    return assignment;
  });
};

const removeEmployeeRole = async (
  employeeId,
  roleId,
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(roleId)) {
    throw new AppError("Invalid ID provided", 400, "INVALID_IDENTIFIER");
  }

  return withTransaction(async (session) => {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    const role = await Role.findById(roleId).session(session);
    if (!role) {
      throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
    }

    const assignment = await EmployeeRole.findOne({
      employeeId: employee._id,
      roleId: role._id,
      isActive: true,
    }).session(session);

    if (!assignment) {
      throw new AppError(
        "Active role assignment not found",
        404,
        "ROLE_ASSIGNMENT_NOT_FOUND",
      );
    }

    // Super Admin Safeguard: If revoking system_super_admin role, assert another Super Admin exists
    if (role.slug === "system_super_admin") {
      await assertNotFinalSuperAdmin({
        targetUserId: employee.userId,
        session,
      });
    }

    const beforeState = assignment.toObject();
    await EmployeeRole.deleteOne({ _id: assignment._id }).session(session);

    // Invalidate permissionVersion on employee user
    await User.findByIdAndUpdate(
      employee.userId,
      { $inc: { permissionVersion: 1 } },
      { session },
    );

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: assignment._id,
      action: "EMPLOYEE_ROLE_REMOVE",
      entityType: "EmployeeRole",
      beforeState,
      afterState: null,
      req,
      session,
    });

    return { success: true, message: "Role assignment removed successfully" };
  });
};

/* =========================================================================
   5. DIRECT PERMISSION GRANTS
   ========================================================================= */

const listEmployeeGrants = async (employeeId) => {
  if (!mongoose.isValidObjectId(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  return EmployeePermissionGrant.find({ employeeId })
    .populate("permissionId")
    .populate("grantedBy", "firstName lastName email")
    .lean();
};

const createEmployeeGrant = async (
  employeeId,
  { permissionId, reason, expiresAt = null },
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(permissionId)) {
    throw new AppError("Invalid ID provided", 400, "INVALID_IDENTIFIER");
  }

  return withTransaction(async (session) => {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (employee.status !== "active") {
      throw new AppError("Employee is not active", 400, "EMPLOYEE_NOT_ACTIVE");
    }

    const permission = await Permission.findById(permissionId).session(session);
    if (!permission) {
      throw new AppError("Permission not found", 404, "PERMISSION_NOT_FOUND");
    }
    if (!permission.isActive) {
      throw new AppError(
        "Cannot grant an inactive permission",
        400,
        "PERMISSION_NOT_ACTIVE",
      );
    }

    const existing = await EmployeePermissionGrant.findOne({
      employeeId: employee._id,
      permissionId: permission._id,
      isActive: true,
    }).session(session);

    if (existing) {
      throw new AppError(
        "Employee already has an active direct grant for this permission",
        409,
        "GRANT_ALREADY_EXISTS",
      );
    }

    const [grant] = await EmployeePermissionGrant.create(
      [
        {
          employeeId: employee._id,
          permissionId: permission._id,
          grantedBy: new mongoose.Types.ObjectId(actorContext.id),
          reason: reason.trim(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isActive: true,
        },
      ],
      { session },
    );

    await User.findByIdAndUpdate(
      employee.userId,
      { $inc: { permissionVersion: 1 } },
      { session },
    );

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: grant._id,
      action: "PERMISSION_GRANT_CREATE",
      entityType: "EmployeePermissionGrant",
      beforeState: null,
      afterState: grant,
      req,
      session,
    });

    return grant;
  });
};

const revokeEmployeeGrant = async (
  employeeId,
  permissionId,
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(permissionId)) {
    throw new AppError("Invalid ID provided", 400, "INVALID_IDENTIFIER");
  }

  return withTransaction(async (session) => {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    const grant = await EmployeePermissionGrant.findOne({
      employeeId: employee._id,
      permissionId,
      isActive: true,
    }).session(session);

    if (!grant) {
      throw new AppError("Active grant not found", 404, "GRANT_NOT_FOUND");
    }

    const beforeState = grant.toObject();
    await EmployeePermissionGrant.deleteOne({ _id: grant._id }).session(session);

    await User.findByIdAndUpdate(
      employee.userId,
      { $inc: { permissionVersion: 1 } },
      { session },
    );

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: grant._id,
      action: "PERMISSION_GRANT_REVOKE",
      entityType: "EmployeePermissionGrant",
      beforeState,
      afterState: null,
      req,
      session,
    });

    return { success: true, message: "Permission grant revoked successfully" };
  });
};

/* =========================================================================
   6. DIRECT PERMISSION RESTRICTIONS
   ========================================================================= */

const listEmployeeRestrictions = async (employeeId) => {
  if (!mongoose.isValidObjectId(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  return EmployeePermissionRestriction.find({ employeeId })
    .populate("permissionId")
    .populate("restrictedBy", "firstName lastName email")
    .lean();
};

const createEmployeeRestriction = async (
  employeeId,
  { permissionId, reason, expiresAt = null },
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(permissionId)) {
    throw new AppError("Invalid ID provided", 400, "INVALID_IDENTIFIER");
  }

  return withTransaction(async (session) => {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    const permission = await Permission.findById(permissionId).session(session);
    if (!permission) {
      throw new AppError("Permission not found", 404, "PERMISSION_NOT_FOUND");
    }

    const existing = await EmployeePermissionRestriction.findOne({
      employeeId: employee._id,
      permissionId: permission._id,
      isActive: true,
    }).session(session);

    if (existing) {
      throw new AppError(
        "Employee already has an active restriction for this permission",
        409,
        "RESTRICTION_ALREADY_EXISTS",
      );
    }

    const [restriction] = await EmployeePermissionRestriction.create(
      [
        {
          employeeId: employee._id,
          permissionId: permission._id,
          restrictedBy: new mongoose.Types.ObjectId(actorContext.id),
          reason: reason.trim(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isActive: true,
        },
      ],
      { session },
    );

    await User.findByIdAndUpdate(
      employee.userId,
      { $inc: { permissionVersion: 1 } },
      { session },
    );

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: restriction._id,
      action: "PERMISSION_RESTRICTION_CREATE",
      entityType: "EmployeePermissionRestriction",
      beforeState: null,
      afterState: restriction,
      req,
      session,
    });

    return restriction;
  });
};

const revokeEmployeeRestriction = async (
  employeeId,
  permissionId,
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(permissionId)) {
    throw new AppError("Invalid ID provided", 400, "INVALID_IDENTIFIER");
  }

  return withTransaction(async (session) => {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    const restriction = await EmployeePermissionRestriction.findOne({
      employeeId: employee._id,
      permissionId,
      isActive: true,
    }).session(session);

    if (!restriction) {
      throw new AppError(
        "Active restriction not found",
        404,
        "RESTRICTION_NOT_FOUND",
      );
    }

    const beforeState = restriction.toObject();
    await EmployeePermissionRestriction.deleteOne({ _id: restriction._id }).session(
      session,
    );

    await User.findByIdAndUpdate(
      employee.userId,
      { $inc: { permissionVersion: 1 } },
      { session },
    );

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: restriction._id,
      action: "PERMISSION_RESTRICTION_REVOKE",
      entityType: "EmployeePermissionRestriction",
      beforeState,
      afterState: null,
      req,
      session,
    });

    return {
      success: true,
      message: "Permission restriction revoked successfully",
    };
  });
};

/* =========================================================================
   7. WORK ASSIGNMENT GOVERNANCE
   ========================================================================= */

const listEmployeeAssignments = async (employeeId) => {
  if (!mongoose.isValidObjectId(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  return WorkAssignment.find({ employeeId })
    .populate("assignedBy", "firstName lastName email")
    .lean();
};

const createWorkAssignment = async (
  employeeId,
  { scopeType, scopeId },
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  const targetType = String(scopeType).trim();
  const targetId = String(scopeId).trim();

  if (!ALLOWED_SCOPE_TYPES.includes(targetType)) {
    throw new AppError(
      `Invalid scopeType. Allowed types: ${ALLOWED_SCOPE_TYPES.join(", ")}`,
      400,
      "INVALID_SCOPE_TYPE",
    );
  }

  return withTransaction(async (session) => {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    // Verify referenced resource existence
    if (targetType === SCOPE_TYPES.VENDOR) {
      if (!mongoose.isValidObjectId(targetId)) {
        throw new AppError("Invalid vendor ID", 400, "INVALID_SCOPE_ID");
      }
      const vendorExists = await Vendor.exists({ _id: targetId }).session(session);
      if (!vendorExists) {
        throw new AppError(
          "Referenced Vendor does not exist",
          404,
          "VENDOR_NOT_FOUND",
        );
      }
    } else if (targetType === SCOPE_TYPES.WAREHOUSE) {
      if (!mongoose.isValidObjectId(targetId)) {
        throw new AppError("Invalid warehouse ID", 400, "INVALID_SCOPE_ID");
      }
      const warehouseExists = await Warehouse.exists({ _id: targetId }).session(session);
      if (!warehouseExists) {
        throw new AppError(
          "Referenced Warehouse does not exist",
          404,
          "WAREHOUSE_NOT_FOUND",
        );
      }
    } else if (targetType === SCOPE_TYPES.CATEGORY) {
      if (!mongoose.isValidObjectId(targetId)) {
        throw new AppError("Invalid category ID", 400, "INVALID_SCOPE_ID");
      }
      const categoryExists = await Category.exists({ _id: targetId }).session(session);
      if (!categoryExists) {
        throw new AppError(
          "Referenced Category does not exist",
          404,
          "CATEGORY_NOT_FOUND",
        );
      }
    } else if (targetType === SCOPE_TYPES.SUPPORT_QUEUE) {
      const validQueues = Object.values(SUPPORT_TICKET_CATEGORIES);
      const normalizedQueue =
        typeof targetId === "string" ? targetId.trim().toLowerCase() : "";
      if (!normalizedQueue || !validQueues.includes(normalizedQueue)) {
        throw new AppError(
          `Support queue '${targetId}' does not exist. Supported queues: ${validQueues.join(", ")}`,
          404,
          "SUPPORT_QUEUE_NOT_FOUND",
        );
      }
    }

    const targetScopeId =
      targetType === SCOPE_TYPES.SUPPORT_QUEUE
        ? targetId.trim().toLowerCase()
        : targetId.toString().trim();

    const existing = await WorkAssignment.findOne({
      employeeId: employee._id,
      scopeType: targetType,
      scopeId: targetScopeId,
    }).session(session);

    if (existing) {
      throw new AppError(
        "Work assignment already exists for this scope and employee",
        409,
        "ASSIGNMENT_ALREADY_EXISTS",
      );
    }

    const [assignment] = await WorkAssignment.create(
      [
        {
          employeeId: employee._id,
          scopeType: targetType,
          scopeId: targetScopeId,
          assignedBy: new mongoose.Types.ObjectId(actorContext.id),
          isActive: true,
        },
      ],
      { session },
    );

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: assignment._id,
      action: "WORK_ASSIGNMENT_CREATE",
      entityType: "WorkAssignment",
      beforeState: null,
      afterState: assignment,
      req,
      session,
    });

    return assignment;
  });
};

const updateWorkAssignment = async (
  employeeId,
  assignmentId,
  { isActive },
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(assignmentId)) {
    throw new AppError("Invalid ID provided", 400, "INVALID_IDENTIFIER");
  }

  return withTransaction(async (session) => {
    const assignment = await WorkAssignment.findOne({
      _id: assignmentId,
      employeeId,
    }).session(session);

    if (!assignment) {
      throw new AppError("Work assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
    }

    const beforeState = assignment.toObject();
    assignment.isActive = isActive;
    await assignment.save({ session });

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: assignment._id,
      action: "WORK_ASSIGNMENT_UPDATE",
      entityType: "WorkAssignment",
      beforeState,
      afterState: assignment,
      req,
      session,
    });

    return assignment;
  });
};

const removeWorkAssignment = async (
  employeeId,
  assignmentId,
  actorContext,
  req,
) => {
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(assignmentId)) {
    throw new AppError("Invalid ID provided", 400, "INVALID_IDENTIFIER");
  }

  return withTransaction(async (session) => {
    const assignment = await WorkAssignment.findOne({
      _id: assignmentId,
      employeeId,
    }).session(session);

    if (!assignment) {
      throw new AppError("Work assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
    }

    const beforeState = assignment.toObject();
    await WorkAssignment.deleteOne({ _id: assignment._id }).session(session);

    await recordAuditLog({
      actorId: actorContext.id,
      targetId: assignment._id,
      action: "WORK_ASSIGNMENT_REMOVE",
      entityType: "WorkAssignment",
      beforeState,
      afterState: null,
      req,
      session,
    });

    return { success: true, message: "Work assignment removed successfully" };
  });
};

/* =========================================================================
   8. AUDIT LOGS READ API
   ========================================================================= */

const listAuditLogs = async ({
  actorId,
  targetId,
  entityType,
  action,
  startDate,
  endDate,
  page = 1,
  limit = 20,
}) => {
  const query = {};

  if (actorId && mongoose.isValidObjectId(actorId)) {
    query.actorId = new mongoose.Types.ObjectId(actorId);
  }
  if (targetId && mongoose.isValidObjectId(targetId)) {
    query.targetId = new mongoose.Types.ObjectId(targetId);
  }
  if (entityType) {
    query.entityType = entityType;
  }
  if (action) {
    query.action = action;
  }
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate("actorId", "firstName lastName email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return { logs, total, page: Number(page), limit: Number(limit) };
};

const getAuditLogById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid audit log ID", 400, "INVALID_AUDIT_LOG_ID");
  }

  const log = await AuditLog.findById(id)
    .populate("actorId", "firstName lastName email role")
    .lean();

  if (!log) {
    throw new AppError("Audit log not found", 404, "AUDIT_LOG_NOT_FOUND");
  }

  return log;
};

/**
 * Atomic bulk update of an employee's permissions.
 * Computes difference with base role, records grants/restrictions,
 * invalidates permission cache via permissionVersion, and creates audit log.
 */
const updateEmployeePermissionsBulk = async ({
  employeeId,
  permissionSlugs,
  actorId,
  req = null,
}) => {
  const {
    getEffectivePermissions,
    incrementPermissionVersion,
  } = require("./authorization.service");

  if (!mongoose.isValidObjectId(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
  }

  const targetUser = await User.findById(employee.userId);
  if (!targetUser) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  // Prevent modifying Superadmin permissions
  if (targetUser.role === "super_admin") {
    throw new AppError(
      "Cannot modify Superadmin permissions",
      400,
      "CANNOT_MODIFY_SUPERADMIN_PERMISSIONS"
    );
  }

  // Validate permission names against server-side registry
  const allPermissions = await Permission.find({ isActive: true }).lean();
  const permMap = new Map();
  for (const p of allPermissions) {
    permMap.set(p.slug, p);
  }

  const validSlugs = new Set();
  for (const slug of permissionSlugs) {
    if (!permMap.has(slug)) {
      throw new AppError(
        `Invalid permission name: ${slug}`,
        400,
        "INVALID_PERMISSION"
      );
    }
    validSlugs.add(slug);
  }

  // Capture Before State
  const beforeEffective = await getEffectivePermissions(targetUser._id);

  // Determine base role permissions
  const activeRoles = await EmployeeRole.find({
    employeeId: employee._id,
    isActive: true,
  }).lean();
  const roleIds = activeRoles.map((r) => r.roleId);
  const rolePermissions = await RolePermission.find({
    roleId: { $in: roleIds },
  }).lean();
  const rolePermIds = new Set(rolePermissions.map((rp) => rp.permissionId.toString()));

  const rolePermSlugs = new Set();
  for (const p of allPermissions) {
    if (rolePermIds.has(p._id.toString())) {
      rolePermSlugs.add(p.slug);
    }
  }

  // Clear existing direct grants and restrictions
  await EmployeePermissionGrant.deleteMany({ employeeId: employee._id });
  await EmployeePermissionRestriction.deleteMany({ employeeId: employee._id });

  // 1. Direct Grants for any requested permission not covered by base role
  for (const slug of validSlugs) {
    if (!rolePermSlugs.has(slug)) {
      const pDoc = permMap.get(slug);
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: pDoc._id,
        reason: "Granted via Superadmin permission management",
        grantedBy: actorId,
        isActive: true,
      });
    }
  }

  // 2. Direct Restrictions for any base role permission stripped in the request
  for (const roleSlug of rolePermSlugs) {
    if (!validSlugs.has(roleSlug)) {
      const pDoc = permMap.get(roleSlug);
      if (pDoc) {
        await EmployeePermissionRestriction.create({
          employeeId: employee._id,
          permissionId: pDoc._id,
          reason: "Restricted via Superadmin permission management",
          restrictedBy: actorId,
          isActive: true,
        });
      }
    }
  }

  // Invalidate authorization context immediately
  await incrementPermissionVersion(targetUser._id);

  const afterEffective = await getEffectivePermissions(targetUser._id);

  await recordAuditLog({
    actorId,
    targetId: employee._id,
    action: "permission.updated",
    entityType: "employee_permissions",
    beforeState: { permissions: beforeEffective },
    afterState: { permissions: afterEffective },
    req,
  });

  return {
    employeeId: employee._id,
    userId: targetUser._id,
    effectivePermissions: afterEffective,
  };
};

module.exports = {
  sanitizeAuditState,
  recordAuditLog,
  countActiveSuperAdmins,
  assertNotFinalSuperAdmin,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  updateRolePermissions,
  listPermissions,
  getPermissionById,
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  listEmployeeRoles,
  assignEmployeeRole,
  removeEmployeeRole,
  listEmployeeGrants,
  createEmployeeGrant,
  revokeEmployeeGrant,
  listEmployeeRestrictions,
  createEmployeeRestriction,
  revokeEmployeeRestriction,
  listEmployeeAssignments,
  createWorkAssignment,
  updateWorkAssignment,
  removeWorkAssignment,
  listAuditLogs,
  getAuditLogById,
  updateEmployeePermissionsBulk,
};
