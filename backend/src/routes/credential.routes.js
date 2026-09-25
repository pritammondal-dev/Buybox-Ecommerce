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
router.use(requirePermissions(PERMISSIONS.SETTINGS_MANAGE));

router.get("/", credentialController.listCredentials);
router.put("/:provider", credentialController.updateCredentials);
router.post("/:provider/test", credentialController.testCredential);

module.exports = router;
