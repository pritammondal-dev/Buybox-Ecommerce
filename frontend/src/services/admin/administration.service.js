export {
  staffService,
  adminStaffService,
  jobRoleService,
  permissionService,
  securityService,
  taskService,
} from "./admin.service.js";

import {
  staffService,
  adminStaffService,
  jobRoleService,
  permissionService,
  securityService,
  taskService,
} from "./admin.service.js";

export const administrationService = {
  staff: staffService,
  adminStaff: adminStaffService,
  jobRoles: jobRoleService,
  permissions: permissionService,
  security: securityService,
  tasks: taskService,
};

export default administrationService;
