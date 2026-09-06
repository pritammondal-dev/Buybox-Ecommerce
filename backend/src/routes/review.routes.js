const express = require("express");

const reviewController = require("../controllers/review.controller");

const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createReviewSchema,
  updateReviewSchema,
  moderateReviewSchema,
  vendorResponseSchema,
  reviewIdParamsSchema,
  productIdParamsSchema,
} = require("../validators/review/review.validator");

const router = express.Router();

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
  requirePermissions("reviews:manage"),
  validate(reviewIdParamsSchema, "params"),
  validate(moderateReviewSchema),
  reviewController.moderateReview
);

router.patch(
  "/:reviewId/vendor-response",
  authenticate,
  requirePermissions("reviews:manage"),
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