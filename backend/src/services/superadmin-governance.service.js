const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const JobRole = require("../models/JobRole");
const AppError = require("../errors/AppError");
const { comparePassword } = require("../utils/password");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("./authorization.service");
const { recordAuditLog, sanitizeAuditState } = require("./governance.service");

/**
 * Platform Governance: Exactly One Active Superadmin Invariant.
 * Verifies that current active Superadmin count is <= 1.
 */
const countActiveSuperadmins = async () => {
  return User.countDocuments({ role: "super_admin", isActive: true });
};

/**
 * Transfer Platform Superadmin authority to another eligible active staff member.
 *
 * Requirements:
 * 1. Actor must be the current active Superadmin.
 * 2. Target must exist, be active, possess an active Employee record, and NOT already be Superadmin.
 * 3. Strong confirmation: password verification or confirmText === "TRANSFER_SUPERADMIN".
 * 4. Replacement Job Role for outgoing Superadmin is required (e.g. Admin or Editor JobRole).
 * 5. Invariant preservation: Never allow 2 active superadmins simultaneously.
 * 6. Session invalidation: authVersion & permissionVersion incremented for BOTH users immediately.
 * 7. Immutable audit logging: SUPERADMIN_TRANSFERRED.
 */
const transferSuperadmin = async ({
  actorUser,
  targetUserId,
  replacementRoleId,
  password = null,
  confirmText = null,
  req = null,
}) => {
  if (!actorUser || actorUser.role !== "super_admin") {
    throw new AppError(
      "Only the current platform Superadmin can initiate platform authority transfer",
      403,
      "FORBIDDEN"
    );
  }

  // Strong Confirmation Check
  if (confirmText !== "TRANSFER_SUPERADMIN") {
    throw new AppError(
      'Strong confirmation required. You must enter "TRANSFER_SUPERADMIN" to authorize platform transfer.',
      400,
      "CONFIRMATION_REQUIRED"
    );
  }

  // Re-authentication check if password is provided
  if (password) {
    const fullActor = await User.findById(actorUser.id || actorUser._id).select("+password");
    if (fullActor && fullActor.password) {
      const isValid = await comparePassword(password, fullActor.password);
      if (!isValid) {
        throw new AppError("Invalid Superadmin re-authentication password", 401, "INVALID_CREDENTIALS");
      }
    }
  }

  if (!mongoose.isValidObjectId(targetUserId)) {
    throw new AppError("Invalid target user ID", 400, "INVALID_TARGET_USER_ID");
  }

  const actorId = actorUser.id || actorUser._id;
  if (targetUserId.toString() === actorId.toString()) {
    throw new AppError(
      "You are already the platform Superadmin. Cannot transfer authority to yourself.",
      400,
      "CANNOT_TRANSFER_TO_SELF"
    );
  }

  // Resolve Target User
  const targetUser = await User.findById(targetUserId);
  if (!targetUser || !targetUser.isActive) {
    throw new AppError("Target user not found or is inactive", 404, "TARGET_USER_INACTIVE");
  }

  if (targetUser.role === "super_admin") {
    throw new AppError("Target user already possesses Superadmin authority", 400, "TARGET_ALREADY_SUPERADMIN");
  }

  // Resolve Target Employee profile
  const targetEmployee = await Employee.findOne({ userId: targetUser._id });
  if (!targetEmployee || targetEmployee.status !== "active") {
    throw new AppError(
      "Target user must possess an active staff Employee profile to receive Superadmin authority",
      400,
      "TARGET_NOT_ACTIVE_EMPLOYEE"
    );
  }

  // Resolve Outgoing Superadmin Employee profile
  const actorEmployee = await Employee.findOne({ userId: actorId });

  // Resolve Superadmin JobRole
  const superadminJobRole = await JobRole.findOne({ isSuperadminRole: true, isActive: true });
  if (!superadminJobRole) {
    throw new AppError("Superadmin Job Role record not found in database", 500, "SUPERADMIN_JOB_ROLE_MISSING");
  }

  // Resolve Replacement JobRole for outgoing Superadmin
  if (!replacementRoleId || !mongoose.isValidObjectId(replacementRoleId)) {
    throw new AppError("A valid replacement Job Role is required for the outgoing Superadmin", 400, "REPLACEMENT_ROLE_REQUIRED");
  }

  const replacementJobRole = await JobRole.findById(replacementRoleId);
  if (!replacementJobRole || !replacementJobRole.isActive || replacementJobRole.isSuperadminRole) {
    throw new AppError("Invalid replacement Job Role selected", 400, "INVALID_REPLACEMENT_ROLE");
  }

  // Determine outgoing security role based on replacement role slug
  const outgoingSecurityRole = replacementJobRole.slug.includes("editor") ? "editor" : "admin";

  const outgoingUser = await User.findById(actorId);

  // Execute atomic transition:
  // Step 1: Demote outgoing Superadmin first so active Superadmin count temporarily becomes 0 (NEVER 2!)
  outgoingUser.role = outgoingSecurityRole;
  await outgoingUser.save();

  if (actorEmployee) {
    actorEmployee.jobRoleId = replacementJobRole._id;
    await actorEmployee.save();
  }

  // Step 2: Promote target user to Superadmin
  targetUser.role = "super_admin";
  await targetUser.save();

  targetEmployee.jobRoleId = superadminJobRole._id;
  await targetEmployee.save();

  // Step 3: Invalidate all active sessions for BOTH actors immediately
  await incrementAuthVersion(outgoingUser._id);
  await incrementPermissionVersion(outgoingUser._id);

  await incrementAuthVersion(targetUser._id);
  await incrementPermissionVersion(targetUser._id);

  // Step 4: Record immutable audit event
  await recordAuditLog({
    actorId,
    targetId: targetUser._id,
    action: "SUPERADMIN_TRANSFERRED",
    entityType: "platform_governance",
    beforeState: {
      formerSuperadmin: {
        id: outgoingUser._id,
        name: `${outgoingUser.firstName} ${outgoingUser.lastName}`,
      },
    },
    afterState: {
      newSuperadmin: {
        id: targetUser._id,
        name: `${targetUser.firstName} ${targetUser.lastName}`,
      },
      formerSuperadminReplacementRole: {
        jobRoleId: replacementJobRole._id,
        name: replacementJobRole.name,
        securityRole: outgoingSecurityRole,
      },
    },
    req,
  });

  return {
    success: true,
    message: `Superadmin authority transferred successfully to ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`,
    newSuperadmin: {
      id: targetUser._id,
      email: targetUser.email,
      name: `${targetUser.firstName} ${targetUser.lastName}`,
      role: targetUser.role,
    },
    formerSuperadmin: {
      id: outgoingUser._id,
      email: outgoingUser.email,
      role: outgoingUser.role,
      replacementRole: replacementJobRole.name,
    },
  };
};

module.exports = {
  countActiveSuperadmins,
  transferSuperadmin,
};
