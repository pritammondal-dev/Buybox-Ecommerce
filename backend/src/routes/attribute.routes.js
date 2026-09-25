const express = require("express");
const attributeController = require("../controllers/attribute.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  createAttributeSchema,
  updateAttributeSchema,
} = require("../validators/catalog/attribute.validator");

const router = express.Router();

// Public / Authenticated read
router.get("/", attributeController.listAttributes);
router.get("/:id", validateObjectId("id"), attributeController.getAttribute);

// Admin-only management (vendors cannot create or modify platform attributes)
router.post(
  "/",
  authenticate,
  requireRoles("admin", "super_admin", "manager"),
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  validate(createAttributeSchema),
  attributeController.createAttribute
);

router.patch(
  "/:id",
  authenticate,
  validateObjectId("id"),
  requireRoles("admin", "super_admin", "manager"),
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  validate(updateAttributeSchema),
  attributeController.updateAttribute
);

router.delete(
  "/:id",
  authenticate,
  validateObjectId("id"),
  requireRoles("admin", "super_admin", "manager"),
  requirePermissions(PERMISSIONS.PRODUCTS_DELETE),
  attributeController.deleteAttribute
);

module.exports = router;
