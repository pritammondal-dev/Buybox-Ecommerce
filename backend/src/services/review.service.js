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
  const { isFeatureEnabled } = require("./storefront-settings.service");
  const reviewsEnabled = await isFeatureEnabled("reviews");
  if (!reviewsEnabled) {
    throw new AppError(
      "Product reviews are currently disabled by platform administration",
      403,
      "REVIEWS_DISABLED"
    );
  }

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

  // Restrict unapproved/rejected/hidden reviews to staff or the reviewing customer
  if (options.user && review.status !== "approved") {
    const isStaff =
      (options.user.permissions && (
        options.user.permissions.includes("reviews:moderate") ||
        options.user.permissions.includes("reviews.moderate") ||
        options.user.permissions.includes("reviews:manage") ||
        options.user.permissions.includes("reviews.manage")
      )) ||
      ["super_admin", "admin", "manager", "editor"].includes(options.user.role);

    let isOwner = false;
    if (options.user.role === "customer") {
      const Customer = require("../models/Customer");
      const customer = await Customer.findOne({ userId: options.user.id }).lean();
      if (customer && review.customerId && review.customerId.toString() === customer._id.toString()) {
        isOwner = true;
      }
    }

    if (!isStaff && !isOwner) {
      throw new AppError(
        "Review not found",
        404,
        "REVIEW_NOT_FOUND"
      );
    }
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

  const productVendorId = (product.vendorId?._id || product.vendorId)?.toString();

  if (
    !vendor ||
    productVendorId !==
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
  reviewId,
  userId = null
) => {
  validateObjectId(
    reviewId,
    "review ID"
  );

  const Review = require("../models/Review");
  const Customer = require("../models/Customer");

  let customer = null;
  if (userId) {
    customer = await Customer.findOne({ userId });
  }

  if (customer) {
    // Idempotent check: if already upvoted, return current review without duplicate increment
    const existingVote = await Review.findOne({
      _id: reviewId,
      helpfulVoters: customer._id,
    });

    if (existingVote) {
      return existingVote;
    }

    // Atomically record voter and increment helpfulCount
    const updated = await Review.findOneAndUpdate(
      {
        _id: reviewId,
        helpfulVoters: { $ne: customer._id },
      },
      {
        $addToSet: { helpfulVoters: customer._id },
        $inc: { helpfulCount: 1 },
      },
      { new: true }
    );

    if (updated) {
      return updated;
    }
  }

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

const Review = require("../models/Review");
const Product = require("../models/Product");
require("../models/ProductVariant");
const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const { encodeSecureId } = require("../utils/secure-id.util");

const getMyVendorReviews = async ({ userId, query = {} }) => {
  const vendor = await resolveApprovedVendor(userId);

  const vendorProducts = await Product.find({
    vendorId: vendor._id,
    deletedAt: null,
  })
    .select("_id name slug sku images")
    .lean();

  const emptyOverview = {
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    distributionPercentages: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    answeredCount: 0,
    unansweredCount: 0,
    verifiedCount: 0,
  };

  const productsList = vendorProducts.map((p) => ({
    _id: p._id,
    name: p.name,
    sku: p.sku,
  }));

  if (vendorProducts.length === 0) {
    return {
      items: [],
      overview: emptyOverview,
      productsList: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        overview: emptyOverview,
        productsList: [],
      },
    };
  }

  const allProductIds = vendorProducts.map((p) => p._id);
  const productMap = new Map(vendorProducts.map((p) => [p._id.toString(), p]));

  // Targeted product filtering
  let targetProductIds = allProductIds;
  if (query.productId) {
    if (productMap.has(query.productId.toString())) {
      targetProductIds = [query.productId];
    } else {
      // Specified product does not belong to vendor
      return {
        items: [],
        overview: emptyOverview,
        productsList,
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          overview: emptyOverview,
          productsList,
        },
      };
    }
  }

  // 1. Calculate Aggregated Overview Stats (Flipkart-Style)
  const statsResult = await Review.aggregate([
    { $match: { productId: { $in: targetProductIds } } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        ratingSum: { $sum: "$rating" },
        star5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
        star4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
        star3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
        star2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
        star1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
        answeredCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$vendorResponse", null] },
                  { $ne: ["$vendorResponse", ""] },
                ],
              },
              1,
              0,
            ],
          },
        },
        verifiedCount: {
          $sum: { $cond: [{ $eq: ["$isVerifiedPurchase", true] }, 1, 0] },
        },
      },
    },
  ]);

  const s = statsResult[0] || {};
  const totalReviewsCount = s.totalReviews || 0;
  const avgRating =
    totalReviewsCount > 0
      ? Number((s.ratingSum / totalReviewsCount).toFixed(1))
      : 0;
  const star5 = s.star5 || 0;
  const star4 = s.star4 || 0;
  const star3 = s.star3 || 0;
  const star2 = s.star2 || 0;
  const star1 = s.star1 || 0;
  const answeredCount = s.answeredCount || 0;
  const unansweredCount = totalReviewsCount - answeredCount;
  const verifiedCount = s.verifiedCount || 0;

  const overview = {
    averageRating: avgRating,
    totalReviews: totalReviewsCount,
    distribution: {
      5: star5,
      4: star4,
      3: star3,
      2: star2,
      1: star1,
    },
    distributionPercentages: {
      5: totalReviewsCount > 0 ? Math.round((star5 / totalReviewsCount) * 100) : 0,
      4: totalReviewsCount > 0 ? Math.round((star4 / totalReviewsCount) * 100) : 0,
      3: totalReviewsCount > 0 ? Math.round((star3 / totalReviewsCount) * 100) : 0,
      2: totalReviewsCount > 0 ? Math.round((star2 / totalReviewsCount) * 100) : 0,
      1: totalReviewsCount > 0 ? Math.round((star1 / totalReviewsCount) * 100) : 0,
    },
    answeredCount,
    unansweredCount,
    verifiedCount,
  };

  // 2. Build Filter for List Query
  const filter = { productId: { $in: targetProductIds } };

  // Star Rating filter
  if (query.rating && [1, 2, 3, 4, 5].includes(Number(query.rating))) {
    filter.rating = Number(query.rating);
  }

  // Answered / Unanswered status filter
  if (query.answered === "true" || query.responseStatus === "answered") {
    filter.vendorResponse = { $nin: [null, ""] };
  } else if (query.answered === "false" || query.responseStatus === "unanswered") {
    filter.$or = [
      { vendorResponse: null },
      { vendorResponse: "" },
      { vendorResponse: { $exists: false } },
    ];
  }

  // Verified purchase filter
  if (query.verified === "true" || query.isVerifiedPurchase === "true") {
    filter.isVerifiedPurchase = true;
  }

  // Free text search (matches review title, review comment, or product name/sku)
  if (query.search && query.search.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const matchingProds = vendorProducts.filter(
      (p) =>
        (p.name && regex.test(p.name)) || (p.sku && regex.test(p.sku))
    );
    const matchingIds = matchingProds.map((p) => p._id);

    const searchConditions = [{ title: regex }, { comment: regex }];
    if (matchingIds.length > 0) {
      searchConditions.push({ productId: { $in: matchingIds } });
    }

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  // 3. Sorting
  const sortOption = query.sort || "newest";
  let sortCriteria = { createdAt: -1 };
  if (sortOption === "rating_high" || sortOption === "rating_desc") {
    sortCriteria = { rating: -1, createdAt: -1 };
  } else if (sortOption === "rating_low" || sortOption === "rating_asc") {
    sortCriteria = { rating: 1, createdAt: -1 };
  } else if (sortOption === "helpful") {
    sortCriteria = { helpfulCount: -1, createdAt: -1 };
  } else if (sortOption === "oldest") {
    sortCriteria = { createdAt: 1 };
  }

  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const [total, reviews] = await Promise.all([
    Review.countDocuments(filter),
    Review.find(filter)
      .populate({
        path: "customerId",
        select: "userId",
        populate: { path: "userId", select: "firstName lastName" },
      })
      .populate("productVariantId", "name sku attributes")
      .sort(sortCriteria)
      .skip(skip)
      .limit(safeLimit)
      .lean(),
  ]);

  const items = reviews.map((r) => {
    const product = productMap.get(r.productId?.toString());
    const user = r.customerId?.userId;
    let customerDisplayName = "Verified Buyer";
    if (user?.firstName) {
      const initial = user.lastName ? ` ${user.lastName.charAt(0)}.` : "";
      customerDisplayName = `${user.firstName}${initial}`;
    }

    const firstImage = product?.images?.[0];
    const thumbnailUrl =
      typeof firstImage === "string" ? firstImage : firstImage?.url || null;

    return {
      _id: r._id,
      secureId: encodeSecureId("review", r._id),
      product: {
        _id: r.productId,
        secureId: encodeSecureId("product", r.productId),
        name: product?.name || "Product",
        title: product?.name || "Product",
        sku: product?.sku || "",
        slug: product?.slug || "",
        thumbnail: thumbnailUrl,
      },
      variant: r.productVariantId
        ? {
            _id: r.productVariantId._id,
            name: r.productVariantId.name || "",
            sku: r.productVariantId.sku || "",
            attributes: r.productVariantId.attributes || {},
          }
        : null,
      customer: {
        displayName: customerDisplayName,
      },
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      status: r.status,
      vendorResponse: r.vendorResponse,
      vendorRespondedAt: r.vendorRespondedAt,
      helpfulCount: r.helpfulCount || 0,
      isVerifiedPurchase: Boolean(r.isVerifiedPurchase),
      createdAt: r.createdAt,
    };
  });

  return {
    items,
    overview,
    productsList,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
      overview,
      productsList,
    },
  };
};

const listAllReviews = async ({ page = 1, limit = 20, status, rating, search } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};
  if (status) filter.status = status;
  if (rating) filter.rating = Number(rating);
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [
      { title: regex },
      { comment: regex },
    ];
  }

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate("productId", "title slug sku")
      .populate({
        path: "customerId",
        select: "userId",
        populate: { path: "userId", select: "firstName lastName email" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  return {
    items: reviews,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

module.exports = {
  createReview,
  getReviewById,
  getProductReviews,
  updateReview,
  moderateReview,
  addVendorResponse,
  markHelpful,
  getMyVendorReviews,
  listAllReviews,
};

