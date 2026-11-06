const express = require("express");
const credentialController = require("../controllers/credential.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const { ROLES } = require("../constants/auth.constants");

const router = express.Router();

// Strictly require authentication and administrative authority
router.use(authenticate);
router.use(requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get("/", requirePermissions(PERMISSIONS.SETTINGS_READ), credentialController.listCredentials);
router.put("/:provider", requirePermissions(PERMISSIONS.SETTINGS_MANAGE), credentialController.updateCredentials);
router.post("/:provider/test", requirePermissions(PERMISSIONS.SETTINGS_MANAGE), credentialController.testCredential);

module.exports = router;
