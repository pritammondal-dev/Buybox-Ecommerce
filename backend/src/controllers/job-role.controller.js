const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const jobRoleService = require("../services/job-role.service");
const superadminGovernanceService = require("../services/superadmin-governance.service");
const jobRoleAuthorityService = require("../services/job-role-authority.service");

const listJobRoles = asyncHandler(async (req, res) => {
  const roles = await jobRoleService.listJobRoles(req.query);
  return sendSuccess(res, {
    statusCode: 200,
    message: "Job Roles retrieved successfully",
    data: { roles },
  });
});

const getJobRole = asyncHandler(async (req, res) => {
  const role = await jobRoleService.getJobRoleById(req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: "Job Role details retrieved successfully",
    data: { role },
  });
});

const createJobRole = asyncHandler(async (req, res) => {
  const role = await jobRoleService.createJobRole(req.body, req.user, req);
  return sendSuccess(res, {
    statusCode: 201,
    message: "Job Role created successfully",
    data: { role },
  });
});

const updateJobRole = asyncHandler(async (req, res) => {
  const role = await jobRoleService.updateJobRole(
    req.params.id,
    req.body,
    req.user,
    req
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: "Job Role updated successfully",
    data: { role },
  });
});

const reorderJobRoles = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;
  const roles = await jobRoleService.reorderJobRoles(
    orderedIds,
    req.user,
    req
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: "Job Role hierarchy reordered successfully",
    data: { roles },
  });
});

const previewRoleMigration = asyncHandler(async (req, res) => {
  const { replacementRoleId } = req.body;
  const preview = await jobRoleService.previewRoleMigration(
    req.params.id,
    replacementRoleId
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: "Role migration preview calculated successfully",
    data: preview,
  });
});

const deactivateJobRole = asyncHandler(async (req, res) => {
  const { replacementRoleId } = req.body;
  const result = await jobRoleService.deactivateJobRole(
    req.params.id,
    replacementRoleId,
    req.user,
    req
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: result.message,
    data: result,
  });
});

const migrateEmployees = asyncHandler(async (req, res) => {
  const { targetRoleId } = req.body;
  const result = await jobRoleService.migrateEmployees(
    req.params.id,
    targetRoleId,
    req.user,
    req
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: result.message,
    data: result,
  });
});

const transferSuperadmin = asyncHandler(async (req, res) => {
  const { targetUserId, replacementRoleId, password, confirmText } = req.body;
  const result = await superadminGovernanceService.transferSuperadmin({
    actorUser: req.user,
    targetUserId,
    replacementRoleId,
    password,
    confirmText,
    req,
  });
  return sendSuccess(res, {
    statusCode: 200,
    message: result.message,
    data: result,
  });
});

const previewRoleChange = asyncHandler(async (req, res) => {
  const { newRoleId } = req.body;
  const preview = await jobRoleAuthorityService.previewEmployeeRoleChange(
    req.user,
    req.params.id,
    newRoleId
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: "Role change preview calculated successfully",
    data: preview,
  });
});

const assignEmployeeRole = asyncHandler(async (req, res) => {
  const { newRoleId, reason } = req.body;
  const result = await jobRoleAuthorityService.assignEmployeeJobRole(
    req.user,
    req.params.id,
    newRoleId,
    { reason, req }
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: result.message,
    data: result,
  });
});

module.exports = {
  listJobRoles,
  getJobRole,
  createJobRole,
  updateJobRole,
  reorderJobRoles,
  previewRoleMigration,
  deactivateJobRole,
  migrateEmployees,
  transferSuperadmin,
  previewRoleChange,
  assignEmployeeRole,
};
