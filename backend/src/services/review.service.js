const mongoose = require("mongoose");

const reviewRepository = require("../repositories/review.repository");
const productRepository = require("../repositories/product.repository");
const orderRepository = require("../repositories/order.repository");
const customerRepository = require("../repositories/customer.repository");
const AppError = require("../errors/AppError");

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

const getActiveCustomer = async (userId) => {
  validateObjectId(userId, "user ID");

  const customer =
    await customerRepository.findByUserId(userId);

  if (!customer || !customer.isActive) {
    throw new AppError(
      "Active customer profile not found",
      404,
      "CUSTOMER_NOT_FOUND"
    );
  }

  return customer;
};

const getActiveProduct = async (productId) => {
  validateObjectId(productId, "product ID");

  const product =
    await productRepository.findById(productId);

  if (
    !product ||
    product.status !== "active" ||
    product.deletedAt
  ) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  return product;
};

const getCustomerOrder = async (
  orderId,
  customerId
) => {
  validateObjectId(orderId, "order ID");

  const order =
    await orderRepository.findById(orderId);

  if (
    !order ||
    order.customerId.toString() !==
      customerId.toString()
  ) {
    throw new AppError(
      "Order not found",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  return order;
};

const createReview = async ({
  userId,
  productId,
  productVariantId = null,
  orderId,
  rating,
  title = null,
  comment = null,
}) => {
  const customer =
    await getActiveCustomer(userId);

  const product =
    await getActiveProduct(productId);

  if (productVariantId !== null) {
    validateObjectId(
      productVariantId,
      "product variant ID"
    );
  }

  const order =
    await getCustomerOrder(
      orderId,
      customer._id
    );

  if (
    !["delivered", "completed"].includes(
      order.status
    )
  ) {
    throw new AppError(
      "Reviews can only be submitted for delivered or completed orders",
      409,
      "ORDER_NOT_ELIGIBLE_FOR_REVIEW"
    );
  }

  const purchasedItem =
    order.items.find((item) => {
      const sameProduct =
        item.productId.toString() ===
        productId.toString();

      if (!sameProduct) {
        return false;
      }

      if (!productVariantId) {
        return true;
      }

      return (
        item.productVariantId.toString() ===
        productVariantId.toString()
      );
    });

  if (!purchasedItem) {
    throw new AppError(
      "Product was not purchased in this order",
      409,
      "PRODUCT_NOT_IN_ORDER"
    );
  }

  const existing =
    await reviewRepository.findByProductAndCustomerOrder(
      productId,
      customer._id,
      orderId
    );

  if (existing) {
    throw new AppError(
      "Review already exists for this product and order",
      409,
      "REVIEW_ALREADY_EXISTS"
    );
  }

  return reviewRepository.create({
    productId: product._id,
    productVariantId,
    customerId: customer._id,
    orderId: order._id,
    rating,
    title,
    comment,
    isVerifiedPurchase: true,
    status: "pending",
  });
};

const getReviewById = async (
  reviewId,
  options = {}
) => {
  validateObjectId(reviewId, "review ID");

  const review =
    await reviewRepository.findById(
      reviewId,
      options
    );

  if (!review) {
    throw new AppError(
      "Review not found",
      404,
      "REVIEW_NOT_FOUND"
    );
  }

  return review;
};

const getProductReviews = async (
  productId
) => {
  await getActiveProduct(productId);

  return reviewRepository.findMany({
    productId,
    status: "approved",
  });
};

const updateReview = async (
  reviewId,
  userId,
  data
) => {
  const customer =
    await getActiveCustomer(userId);

  const review =
    await getReviewById(reviewId);

  if (
    review.customerId.toString() !==
    customer._id.toString()
  ) {
    throw new AppError(
      "You are not allowed to modify this review",
      403,
      "REVIEW_ACCESS_DENIED"
    );
  }

  if (review.status !== "pending") {
    throw new AppError(
      "Only pending reviews can be edited",
      409,
      "REVIEW_NOT_EDITABLE"
    );
  }

  return reviewRepository.updateById(
    reviewId,
    {
      ...(data.rating !== undefined && {
        rating: data.rating,
      }),
      ...(data.title !== undefined && {
        title: data.title,
      }),
      ...(data.comment !== undefined && {
        comment: data.comment,
      }),
    }
  );
};

const moderateReview = async (
  reviewId,
  status,
  moderationReason = null
) => {
  validateObjectId(reviewId, "review ID");

  if (
    !["approved", "rejected", "hidden"].includes(
      status
    )
  ) {
    throw new AppError(
      "Invalid review moderation status",
      400,
      "INVALID_REVIEW_STATUS"
    );
  }

  if (
    status === "rejected" &&
    (!moderationReason ||
      !moderationReason.trim())
  ) {
    throw new AppError(
      "Moderation reason is required when rejecting a review",
      400,
      "MODERATION_REASON_REQUIRED"
    );
  }

  await getReviewById(reviewId);

  return reviewRepository.updateById(
    reviewId,
    {
      status,
      moderationReason:
        moderationReason?.trim() || null,
      moderatedAt: new Date(),
    }
  );
};

const addVendorResponse = async (
  reviewId,
  userId,
  response
) => {
  if (
    !response ||
    !response.trim()
  ) {
    throw new AppError(
      "Vendor response is required",
      400,
      "VENDOR_RESPONSE_REQUIRED"
    );
  }

  const review =
    await getReviewById(reviewId);

  const product =
    await getActiveProduct(
      review.productId
    );

  const Vendor =
    require("../models/Vendor");

  const vendor =
    await Vendor.findOne({
      userId,
      isActive: true,
      deletedAt: null,
    });

  if (
    !vendor ||
    product.vendorId.toString() !==
      vendor._id.toString()
  ) {
    throw new AppError(
      "You are not allowed to respond to this review",
      403,
      "REVIEW_VENDOR_ACCESS_DENIED"
    );
  }

  return reviewRepository.updateById(
    reviewId,
    {
      vendorResponse:
        response.trim(),
      vendorRespondedAt:
        new Date(),
    }
  );
};

const markHelpful = async (
  reviewId
) => {
  validateObjectId(
    reviewId,
    "review ID"
  );

  const review =
    await reviewRepository.incrementHelpfulCount(
      reviewId
    );

  if (!review) {
    throw new AppError(
      "Review not found",
      404,
      "REVIEW_NOT_FOUND"
    );
  }

  return review;
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

