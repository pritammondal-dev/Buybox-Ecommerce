const express = require("express");

const reviewController = require("../controllers/review.controller");

const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");
const { ROLES } = require("../constants/auth.constants");
const validate = require("../middlewares/validate.middleware");

const {
  createReviewSchema,
  updateReviewSchema,
  moderateReviewSchema,
  vendorResponseSchema,
  reviewIdParamsSchema,
  productIdParamsSchema,
} = require("../validators/review/review.validator");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

// Vendor-scoped reviews (must precede /:reviewId)
router.get(
  "/vendor/my",
  authenticate,
  requireRoles(ROLES.VENDOR),
  reviewController.getMyVendorReviews
);

// Admin list all reviews
router.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.REVIEWS_READ),
  reviewController.listAllReviews
);

router.post(
  "/",
  authenticate,
  validate(createReviewSchema),
  reviewController.createReview
);

router.get(
  "/:reviewId",
  authenticate,
  validate(reviewIdParamsSchema, "params"),
  reviewController.getReviewById
);

router.get(
  "/product/:productId",
  validate(productIdParamsSchema, "params"),
  reviewController.getProductReviews
);

router.patch(
  "/:reviewId",
  authenticate,
  validate(reviewIdParamsSchema, "params"),
  validate(updateReviewSchema),
  reviewController.updateReview
);

router.patch(
  "/:reviewId/moderate",
  authenticate,
  requirePermissions(PERMISSIONS.REVIEWS_MODERATE),
  validate(reviewIdParamsSchema, "params"),
  validate(moderateReviewSchema),
  reviewController.moderateReview
);

router.patch(
  "/:reviewId/moderation",
  authenticate,
  requirePermissions(PERMISSIONS.REVIEWS_MODERATE),
  validate(reviewIdParamsSchema, "params"),
  validate(moderateReviewSchema),
  reviewController.moderateReview
);

router.patch(
  "/:reviewId/vendor-response",
  authenticate,
  requirePermissions(PERMISSIONS.REVIEWS_MANAGE),
  validate(reviewIdParamsSchema, "params"),
  validate(vendorResponseSchema),
  reviewController.addVendorResponse
);

router.post(
  "/:reviewId/helpful",
  authenticate,
  validate(reviewIdParamsSchema, "params"),
  reviewController.markHelpful
);

module.exports = router;