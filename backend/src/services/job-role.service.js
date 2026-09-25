const mongoose = require("mongoose");
const JobRole = require("../models/JobRole");
const Employee = require("../models/Employee");
const User = require("../models/User");
const AppError = require("../errors/AppError");
const {
  recordAuditLog,
  sanitizeAuditState,
} = require("./governance.service");
const {
  incrementPermissionVersion,
  incrementAuthVersion,
} = require("./authorization.service");

/**
 * List all Job Roles with live employee counts and populated management scope.
 * Sorted by tier ascending (Tier 1 = highest authority).
 */
const listJobRoles = async (query = {}) => {
  const filter = {};
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true" || query.isActive === true;
  }

  const roles = await JobRole.find(filter)
    .populate("managementScope", "name slug tier isActive isSystemRole")
    .populate("createdBy", "firstName lastName email")
    .populate("updatedBy", "firstName lastName email")
    .sort({ tier: 1, createdAt: 1 })
    .lean();

  // Compute live employee counts per Job Role
  const roleIds = roles.map((r) => r._id);
  const employeeCounts = await Employee.aggregate([
    { $match: { jobRoleId: { $in: roleIds } } },
    { $group: { _id: "$jobRoleId", count: { $sum: 1 } } },
  ]);

  const countMap = new Map();
  for (const ec of employeeCounts) {
    countMap.set(ec._id.toString(), ec.count);
  }

  return roles.map((role) => ({
    ...role,
    id: role._id,
    employeeCount: countMap.get(role._id.toString()) || 0,
    permissionCount: Array.isArray(role.permissions) ? role.permissions.length : 0,
    managementScopeCount: Array.isArray(role.managementScope) ? role.managementScope.length : 0,
  }));
};

/**
 * Get single Job Role by ID with assigned employees and detail breakdown.
 */
const getJobRoleById = async (id) => {
  let role;
  if (mongoose.isValidObjectId(id)) {
    role = await JobRole.findById(id)
      .populate("managementScope", "name slug tier isActive isSystemRole")
      .populate("createdBy", "firstName lastName email")
      .populate("updatedBy", "firstName lastName email")
      .lean();
  } else {
    role = await JobRole.findOne({ slug: id })
      .populate("managementScope", "name slug tier isActive isSystemRole")
      .populate("createdBy", "firstName lastName email")
      .populate("updatedBy", "firstName lastName email")
      .lean();
  }

  if (!role) {
    throw new AppError("Job Role not found", 404, "JOB_ROLE_NOT_FOUND");
  }

  const employees = await Employee.find({ jobRoleId: role._id })
    .populate("userId", "firstName lastName email role isActive lastLoginAt")
    .select("employeeNumber jobTitle department status activatedAt createdAt")
    .lean();

  return {
    ...role,
    id: role._id,
    employeeCount: employees.length,
    permissionCount: Array.isArray(role.permissions) ? role.permissions.length : 0,
    employees: employees.map((emp) => ({
      id: emp._id,
      employeeNumber: emp.employeeNumber,
      jobTitle: emp.jobTitle,
      department: emp.department,
      status: emp.status,
      user: emp.userId
        ? {
            id: emp.userId._id,
            firstName: emp.userId.firstName,
            lastName: emp.userId.lastName,
            email: emp.userId.email,
            securityRole: emp.userId.role,
            isActive: emp.userId.isActive,
            lastLoginAt: emp.userId.lastLoginAt,
          }
        : null,
    })),
  };
};

/**
 * Create a new Job Role.
 * Restricted to Superadmin.
 */
const createJobRole = async (payload, actor, req = null) => {
  const {
    name,
    slug,
    description = null,
    permissions = [],
    managementScope = [],
    tier,
  } = payload;

  if (!name || !name.trim()) {
    throw new AppError("Role name is required", 400, "MISSING_ROLE_NAME");
  }

  const normalizedName = name.trim();
  const normalizedSlug = (slug || normalizedName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalizedSlug) {
    throw new AppError("Invalid role slug", 400, "INVALID_ROLE_SLUG");
  }

  // Check unique name and slug
  const existing = await JobRole.findOne({
    $or: [{ slug: normalizedSlug }, { name: normalizedName }],
  });
  if (existing) {
    throw new AppError(
      "A Job Role with this name or slug already exists",
      409,
      "JOB_ROLE_EXISTS"
    );
  }

  // Determine tier: cannot usurp Tier 1 (reserved for Superadmin)
  let assignedTier = Number(tier);
  const maxTierRole = await JobRole.findOne().sort({ tier: -1 }).lean();
  const defaultTier = maxTierRole ? maxTierRole.tier + 1 : 2;

  if (!assignedTier || isNaN(assignedTier) || assignedTier < 2) {
    assignedTier = defaultTier;
  } else {
    // If inserting at an existing tier >= 2, shift existing roles down
    await JobRole.updateMany(
      { tier: { $gte: assignedTier } },
      { $inc: { tier: 1 } }
    );
  }

  // Validate management scope IDs
  let validatedScope = [];
  if (Array.isArray(managementScope) && managementScope.length > 0) {
    const validRoles = await JobRole.find({
      _id: { $in: managementScope },
      isActive: true,
    }).select("_id");
    validatedScope = validRoles.map((r) => r._id);
  }

  const actorId = actor?._id || actor?.id;

  const newRole = await JobRole.create({
    name: normalizedName,
    slug: normalizedSlug,
    description: description ? description.trim() : null,
    tier: assignedTier,
    permissions: Array.isArray(permissions) ? [...new Set(permissions)] : [],
    managementScope: validatedScope,
    isSystemRole: false,
    isSuperadminRole: false,
    isActive: true,
    createdBy: actorId,
    updatedBy: actorId,
  });

  await recordAuditLog({
    actorId,
    targetId: newRole._id,
    action: "JOB_ROLE_CREATED",
    entityType: "job_role",
    afterState: sanitizeAuditState(newRole.toObject()),
    req,
  });

  return getJobRoleById(newRole._id);
};

/**
 * Update an existing Job Role.
 * Restricted to Superadmin.
 */
const updateJobRole = async (id, payload, actor, req = null) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid Job Role ID", 400, "INVALID_ID");
  }

  const role = await JobRole.findById(id);
  if (!role) {
    throw new AppError("Job Role not found", 404, "JOB_ROLE_NOT_FOUND");
  }

  const beforeState = sanitizeAuditState(role.toObject());
  const actorId = actor?._id || actor?.id;

  // Protect Superadmin role from disruption
  if (role.isSuperadminRole) {
    if (payload.isActive === false) {
      throw new AppError(
        "Superadmin Job Role cannot be deactivated",
        400,
        "CANNOT_DEACTIVATE_SUPERADMIN_ROLE"
      );
    }
    if (payload.tier !== undefined && payload.tier !== 1) {
      throw new AppError(
        "Superadmin Job Role must remain Tier 1",
        400,
        "CANNOT_CHANGE_SUPERADMIN_TIER"
      );
    }
  }

  // Update name if permitted
  if (payload.name && payload.name.trim() !== role.name) {
    if (role.isSystemRole) {
      throw new AppError(
        "System Job Role names cannot be renamed",
        400,
        "CANNOT_RENAME_SYSTEM_ROLE"
      );
    }
    const duplicate = await JobRole.findOne({
      name: payload.name.trim(),
      _id: { $ne: role._id },
    });
    if (duplicate) {
      throw new AppError(
        "Job Role with this name already exists",
        409,
        "JOB_ROLE_NAME_EXISTS"
      );
    }
    role.name = payload.name.trim();
  }

  if (payload.description !== undefined) {
    role.description = payload.description ? payload.description.trim() : null;
  }

  let permissionsChanged = false;
  if (Array.isArray(payload.permissions)) {
    // If not superadmin role, update permissions
    if (!role.isSuperadminRole) {
      const newPerms = [...new Set(payload.permissions)];
      const oldPerms = new Set(role.permissions);
      const added = newPerms.filter((p) => !oldPerms.has(p));
      const removed = role.permissions.filter((p) => !newPerms.includes(p));

      if (added.length > 0 || removed.length > 0) {
        permissionsChanged = true;
        role.permissions = newPerms;

        if (added.length > 0) {
          await recordAuditLog({
            actorId,
            targetId: role._id,
            action: "ROLE_PERMISSION_ADDED",
            entityType: "job_role",
            afterState: { addedPermissions: added },
            req,
          });
        }
        if (removed.length > 0) {
          await recordAuditLog({
            actorId,
            targetId: role._id,
            action: "ROLE_PERMISSION_REMOVED",
            entityType: "job_role",
            afterState: { removedPermissions: removed },
            req,
          });
        }
      }
    }
  }

  let scopeChanged = false;
  if (Array.isArray(payload.managementScope)) {
    const validRoles = await JobRole.find({
      _id: { $in: payload.managementScope, $ne: role._id },
      isActive: true,
    }).select("_id");
    const newScopeIds = validRoles.map((r) => r._id.toString());
    const oldScopeIds = role.managementScope.map((s) => s.toString());

    if (
      newScopeIds.length !== oldScopeIds.length ||
      !newScopeIds.every((id) => oldScopeIds.includes(id))
    ) {
      scopeChanged = true;
      role.managementScope = validRoles.map((r) => r._id);

      await recordAuditLog({
        actorId,
        targetId: role._id,
        action: "ROLE_MANAGEMENT_SCOPE_CHANGED",
        entityType: "job_role",
        beforeState: { managementScope: oldScopeIds },
        afterState: { managementScope: newScopeIds },
        req,
      });
    }
  }

  if (payload.isActive !== undefined && !role.isSuperadminRole) {
    role.isActive = Boolean(payload.isActive);
  }

  role.updatedBy = actorId;
  await role.save();

  // If permissions, managementScope, or active status changed:
  // Invalidate authorization for all employees with this role
  if (permissionsChanged || scopeChanged || payload.isActive !== undefined) {
    const employees = await Employee.find({ jobRoleId: role._id }).select("userId");
    for (const emp of employees) {
      if (emp.userId) {
        await incrementPermissionVersion(emp.userId);
      }
    }
  }

  await recordAuditLog({
    actorId,
    targetId: role._id,
    action: "JOB_ROLE_UPDATED",
    entityType: "job_role",
    beforeState,
    afterState: sanitizeAuditState(role.toObject()),
    req,
  });

  return getJobRoleById(role._id);
};

/**
 * Reorder Job Roles hierarchy.
 * Superadmin only.
 * Atomically updates all tiers, audits old vs new hierarchy, and invalidates affected sessions.
 *
 * @param {string[]} orderedIds - Ordered array of JobRole IDs from top authority (Tier 1) to lowest
 * @param {Object} actor - Authenticated Superadmin user
 */
const reorderJobRoles = async (orderedIds, actor, req = null) => {
  if (!Array.isArray(orderedIds) || orderedIds.length < 2) {
    throw new AppError(
      "A complete ordered list of Job Role IDs is required to reorder hierarchy",
      400,
      "INVALID_REORDER_PAYLOAD"
    );
  }

  // Ensure no duplicate IDs
  const uniqueIds = [...new Set(orderedIds)];
  if (uniqueIds.length !== orderedIds.length) {
    throw new AppError(
      "Duplicate Job Role IDs detected in reorder list",
      400,
      "DUPLICATE_ROLE_IDS"
    );
  }

  // Verify all IDs are valid ObjectIds
  for (const id of orderedIds) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(`Invalid Job Role ID: ${id}`, 400, "INVALID_ID");
    }
  }

  // Retrieve current active roles from database
  const activeRoles = await JobRole.find({ isActive: true }).lean();
  const activeRoleMap = new Map();
  for (const r of activeRoles) {
    activeRoleMap.set(r._id.toString(), r);
  }

  // Ensure every active role is included in the reorder request
  for (const r of activeRoles) {
    if (!uniqueIds.includes(r._id.toString())) {
      throw new AppError(
        `Missing active role from reorder hierarchy: ${r.name}`,
        400,
        "INCOMPLETE_HIERARCHY"
      );
    }
  }

  // Superadmin role invariant: Superadmin role must always occupy Tier 1
  const superadminRole = activeRoles.find((r) => r.isSuperadminRole);
  if (superadminRole) {
    const superadminId = superadminRole._id.toString();
    if (uniqueIds[0] !== superadminId) {
      throw new AppError(
        "Superadmin role must always occupy the highest authority (Tier 1)",
        400,
        "SUPERADMIN_TIER_IMMUTABLE"
      );
    }
  }

  // Prepare before and after state diffs
  const oldHierarchy = activeRoles
    .sort((a, b) => a.tier - b.tier)
    .map((r) => ({ id: r._id.toString(), name: r.name, tier: r.tier }));

  const newHierarchy = [];
  const bulkOperations = [];
  const affectedRoleIds = [];

  for (let index = 0; index < orderedIds.length; index++) {
    const roleId = orderedIds[index];
    const newTier = index + 1;
    const existing = activeRoleMap.get(roleId);

    if (existing) {
      newHierarchy.push({ id: roleId, name: existing.name, tier: newTier });
      if (existing.tier !== newTier) {
        affectedRoleIds.push(new mongoose.Types.ObjectId(roleId));
        bulkOperations.push({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(roleId) },
            update: { $set: { tier: newTier, updatedAt: new Date() } },
          },
        });
      }
    }
  }

  if (bulkOperations.length > 0) {
    await JobRole.bulkWrite(bulkOperations);

    // Invalidate permission version for all employees holding affected roles
    const affectedEmployees = await Employee.find({
      jobRoleId: { $in: affectedRoleIds },
    }).select("userId");

    for (const emp of affectedEmployees) {
      if (emp.userId) {
        await incrementPermissionVersion(emp.userId);
      }
    }
  }

  const actorId = actor?._id || actor?.id;

  await recordAuditLog({
    actorId,
    targetId: null,
    action: "JOB_ROLE_REORDERED",
    entityType: "job_role",
    beforeState: { hierarchy: oldHierarchy },
    afterState: { hierarchy: newHierarchy },
    req,
  });

  return listJobRoles();
};

/**
 * Preview employee migration before deactivating a Job Role.
 */
const previewRoleMigration = async (sourceRoleId, replacementRoleId) => {
  if (!mongoose.isValidObjectId(sourceRoleId)) {
    throw new AppError("Invalid source Job Role ID", 400, "INVALID_ID");
  }

  const sourceRole = await JobRole.findById(sourceRoleId).lean();
  if (!sourceRole) {
    throw new AppError("Source Job Role not found", 404, "SOURCE_ROLE_NOT_FOUND");
  }

  let replacementRole = null;
  if (replacementRoleId) {
    if (!mongoose.isValidObjectId(replacementRoleId)) {
      throw new AppError("Invalid replacement Job Role ID", 400, "INVALID_ID");
    }
    replacementRole = await JobRole.findById(replacementRoleId).lean();
    if (!replacementRole || !replacementRole.isActive) {
      throw new AppError(
        "Replacement Job Role not found or inactive",
        400,
        "INVALID_REPLACEMENT_ROLE"
      );
    }
    if (replacementRole._id.toString() === sourceRole._id.toString()) {
      throw new AppError(
        "Replacement role must be different from source role",
        400,
        "CANNOT_MIGRATE_TO_SELF"
      );
    }
  }

  const employees = await Employee.find({ jobRoleId: sourceRole._id })
    .populate("userId", "firstName lastName email role isActive")
    .select("employeeNumber jobTitle department status")
    .lean();

  const sourcePerms = new Set(sourceRole.permissions || []);
  const targetPerms = new Set(replacementRole?.permissions || []);

  const permissionsGained = [...targetPerms].filter((p) => !sourcePerms.has(p));
  const permissionsLost = [...sourcePerms].filter((p) => !targetPerms.has(p));

  return {
    sourceRole: {
      id: sourceRole._id,
      name: sourceRole.name,
      slug: sourceRole.slug,
      tier: sourceRole.tier,
      isSystemRole: sourceRole.isSystemRole,
    },
    replacementRole: replacementRole
      ? {
          id: replacementRole._id,
          name: replacementRole.name,
          slug: replacementRole.slug,
          tier: replacementRole.tier,
        }
      : null,
    employeeCount: employees.length,
    employees: employees.map((e) => ({
      id: e._id,
      employeeNumber: e.employeeNumber,
      jobTitle: e.jobTitle,
      department: e.department,
      status: e.status,
      user: e.userId
        ? {
            id: e.userId._id,
            email: e.userId.email,
            name: `${e.userId.firstName} ${e.userId.lastName}`.trim(),
          }
        : null,
    })),
    permissionsGained,
    permissionsLost,
  };
};

/**
 * Deactivate a Job Role.
 * If employees currently hold this role, replacementRoleId is mandatory.
 * Atomically migrates all employees to replacement role and deactivates role.
 */
const deactivateJobRole = async (
  roleId,
  replacementRoleId = null,
  actor,
  req = null
) => {
  if (!mongoose.isValidObjectId(roleId)) {
    throw new AppError("Invalid Job Role ID", 400, "INVALID_ID");
  }

  const role = await JobRole.findById(roleId);
  if (!role) {
    throw new AppError("Job Role not found", 404, "JOB_ROLE_NOT_FOUND");
  }

  if (role.isSuperadminRole) {
    throw new AppError(
      "The Superadmin Job Role cannot be deactivated",
      400,
      "CANNOT_DEACTIVATE_SUPERADMIN_ROLE"
    );
  }

  const employeeCount = await Employee.countDocuments({ jobRoleId: role._id });

  if (employeeCount > 0) {
    if (!replacementRoleId) {
      throw new AppError(
        `This role is currently assigned to ${employeeCount} employee(s). A replacement Job Role is required before deactivating.`,
        400,
        "REPLACEMENT_ROLE_REQUIRED"
      );
    }

    if (!mongoose.isValidObjectId(replacementRoleId)) {
      throw new AppError("Invalid replacement Job Role ID", 400, "INVALID_ID");
    }

    if (replacementRoleId.toString() === roleId.toString()) {
      throw new AppError(
        "Replacement Job Role must be different from the role being deactivated",
        400,
        "CANNOT_MIGRATE_TO_SELF"
      );
    }

    const replacement = await JobRole.findById(replacementRoleId);
    if (!replacement || !replacement.isActive) {
      throw new AppError(
        "Replacement Job Role is not found or is inactive",
        400,
        "INVALID_REPLACEMENT_ROLE"
      );
    }

    // Atomically migrate all employees to replacement role
    const employees = await Employee.find({ jobRoleId: role._id });
    await Employee.updateMany(
      { jobRoleId: role._id },
      { jobRoleId: replacement._id }
    );

    const actorId = actor?._id || actor?.id;

    // Invalidate sessions for all migrated employees
    for (const emp of employees) {
      if (emp.userId) {
        await incrementAuthVersion(emp.userId);
        await incrementPermissionVersion(emp.userId);
      }
    }

    await recordAuditLog({
      actorId,
      targetId: role._id,
      action: "ROLE_EMPLOYEE_MIGRATION",
      entityType: "job_role",
      beforeState: { sourceRoleId: role._id, sourceRoleName: role.name },
      afterState: {
        replacementRoleId: replacement._id,
        replacementRoleName: replacement.name,
        migratedCount: employeeCount,
      },
      req,
    });
  }

  role.isActive = false;
  role.updatedBy = actor?._id || actor?.id;
  await role.save();

  // Remove this role from any other role's managementScope
  await JobRole.updateMany(
    { managementScope: role._id },
    { $pull: { managementScope: role._id } }
  );

  const actorId = actor?._id || actor?.id;

  await recordAuditLog({
    actorId,
    targetId: role._id,
    action: "JOB_ROLE_DEACTIVATED",
    entityType: "job_role",
    afterState: { id: role._id, name: role.name, isActive: false },
    req,
  });

  return {
    success: true,
    message: `Job Role '${role.name}' deactivated successfully`,
    migratedEmployeesCount: employeeCount,
  };
};

/**
 * Bulk migrate employees from one Job Role to another.
 * Superadmin only.
 */
const migrateEmployees = async (sourceRoleId, targetRoleId, actor, req = null) => {
  if (!mongoose.isValidObjectId(sourceRoleId) || !mongoose.isValidObjectId(targetRoleId)) {
    throw new AppError("Invalid Job Role IDs provided", 400, "INVALID_ID");
  }

  if (sourceRoleId.toString() === targetRoleId.toString()) {
    throw new AppError("Source and target Job Roles must be different", 400, "CANNOT_MIGRATE_TO_SELF");
  }

  const [source, target] = await Promise.all([
    JobRole.findById(sourceRoleId),
    JobRole.findById(targetRoleId),
  ]);

  if (!source) throw new AppError("Source Job Role not found", 404, "SOURCE_NOT_FOUND");
  if (!target || !target.isActive) throw new AppError("Target Job Role not found or inactive", 400, "TARGET_NOT_FOUND");

  const employees = await Employee.find({ jobRoleId: source._id });
  const count = employees.length;

  if (count > 0) {
    await Employee.updateMany(
      { jobRoleId: source._id },
      { jobRoleId: target._id }
    );

    for (const emp of employees) {
      if (emp.userId) {
        await incrementAuthVersion(emp.userId);
        await incrementPermissionVersion(emp.userId);
      }
    }
  }

  const actorId = actor?._id || actor?.id;

  await recordAuditLog({
    actorId,
    targetId: source._id,
    action: "ROLE_EMPLOYEE_MIGRATION",
    entityType: "job_role",
    beforeState: { sourceRoleId: source._id, sourceRoleName: source.name },
    afterState: {
      targetRoleId: target._id,
      targetRoleName: target.name,
      migratedCount: count,
    },
    req,
  });

  return {
    success: true,
    message: `Migrated ${count} employee(s) from ${source.name} to ${target.name}`,
    migratedCount: count,
  };
};

module.exports = {
  listJobRoles,
  getJobRoleById,
  createJobRole,
  updateJobRole,
  reorderJobRoles,
  previewRoleMigration,
  deactivateJobRole,
  migrateEmployees,
};
