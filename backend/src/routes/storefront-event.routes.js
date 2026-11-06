const express = require("express");
const specialEventPageController = require("../controllers/special-event-page.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { authenticateOptional } = authenticate;
const validate = require("../middlewares/validate.middleware");
const {
  specialEventPageSlugParamsSchema,
} = require("../validators/cms/special-event-page.validator");

const router = express.Router();

// Public active events discovery
router.get("/active", specialEventPageController.getActiveEvents);

// Public event page by slug (supports ?preview=true&token=... and optional admin bearer auth)
router.get(
  "/slug/:slug",
  authenticateOptional,
  validate(specialEventPageSlugParamsSchema, "params"),
  specialEventPageController.getPublicPageBySlug
);

router.get(
  "/:slug",
  authenticateOptional,
  validate(specialEventPageSlugParamsSchema, "params"),
  specialEventPageController.getPublicPageBySlug
);

module.exports = router;
