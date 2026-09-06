const reviewService = require("../services/review.service");
const { sendSuccess } = require("../utils/apiResponse");

const createReview = async (req, res, next) => {
  try {
    const review = await reviewService.createReview({
      userId: req.user.id,
      ...req.body,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Review submitted successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

const getReviewById = async (req, res, next) => {
  try {
    const review = await reviewService.getReviewById(
      req.params.reviewId
    );

    return sendSuccess(res, {
      message: "Review fetched successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

const getProductReviews = async (req, res, next) => {
  try {
    const reviews = await reviewService.getProductReviews(
      req.params.productId
    );

    return sendSuccess(res, {
      message: "Product reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

const updateReview = async (req, res, next) => {
  try {
    const review = await reviewService.updateReview(
      req.params.reviewId,
      req.user.id,
      req.body
    );

    return sendSuccess(res, {
      message: "Review updated successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

const moderateReview = async (req, res, next) => {
  try {
    const review = await reviewService.moderateReview(
      req.params.reviewId,
      req.body.status,
      req.body.moderationReason
    );

    return sendSuccess(res, {
      message: "Review moderated successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

const addVendorResponse = async (req, res, next) => {
  try {
    const review = await reviewService.addVendorResponse(
      req.params.reviewId,
      req.user.id,
      req.body.response
    );

    return sendSuccess(res, {
      message: "Vendor response added successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

const markHelpful = async (req, res, next) => {
  try {
    const review = await reviewService.markHelpful(
      req.params.reviewId
    );

    return sendSuccess(res, {
      message: "Review marked as helpful",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getReviewById,
  getProductReviews,
  updateReview,
  moderateReview,
  addVendorResponse,
  markHelpful,
};

