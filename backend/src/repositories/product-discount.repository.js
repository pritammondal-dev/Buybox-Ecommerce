const mongoose = require("mongoose");
const ProductDiscount = require("../models/ProductDiscount");
const {
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
} = require("../constants/promotion.constants");

/**
 * Create a new product discount promotion record.
 *
 * @param {Object} data
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
const create = async (data, options = {}) => {
  const discount = new ProductDiscount(data);
  return discount.save(options);
};

/**
 * Find a product discount promotion by ID.
 *
 * @param {string|import("mongoose").Types.ObjectId} id
 * @param {Object} [options]
 * @returns {Promise<Object|null>}
 */
const findById = async (id, options = {}) => {
  return ProductDiscount.findOne({
    _id: id,
    deletedAt: null,
  }).session(options.session || null);
};

/**
 * Find multiple product discount promotions matching a filter.
 *
 * @param {Object} [filter]
 * @param {Object} [options]
 * @returns {Promise<Array>}
 */
const findMany = async (filter = {}, options = {}) => {
  const effectiveFilter = { deletedAt: null, ...filter };
  return ProductDiscount.find(effectiveFilter)
    .sort(options.sort || { priority: -1, createdAt: -1 })
    .session(options.session || null);
};

/**
 * Update a product discount promotion by ID.
 *
 * @param {string|import("mongoose").Types.ObjectId} id
 * @param {Object} update
 * @param {Object} [options]
 * @returns {Promise<Object|null>}
 */
const updateById = async (id, update, options = {}) => {
  return ProductDiscount.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });
};

/**
 * Soft delete a product discount promotion by ID.
 *
 * @param {string|import("mongoose").Types.ObjectId} id
 * @param {Object} [options]
 * @returns {Promise<Object|null>}
 */
const deleteById = async (id, options = {}) => {
  return ProductDiscount.findByIdAndUpdate(
    id,
    {
      deletedAt: new Date(),
      status: DISCOUNT_STATUSES.CANCELLED,
    },
    {
      new: true,
      session: options.session || null,
    }
  );
};

/**
 * Find all active and time-eligible promotions for a target product/variant/category/brand.
 *
 * @param {Object} params
 * @param {Date} [params.asOfDate] Date to check against (defaults to now)
 * @param {string|import("mongoose").Types.ObjectId} [params.productId]
 * @param {string|import("mongoose").Types.ObjectId} [params.variantId]
 * @param {string|import("mongoose").Types.ObjectId} [params.categoryId]
 * @param {string|import("mongoose").Types.ObjectId} [params.brandId]
 * @param {Object} [params.options]
 * @returns {Promise<Array>}
 */
const findEligibleDiscounts = async ({
  asOfDate = new Date(),
  productId = null,
  variantId = null,
  categoryId = null,
  brandId = null,
  options = {},
}) => {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const query = {
    deletedAt: null,
    status: DISCOUNT_STATUSES.ACTIVE,
    startsAt: { $lte: asOfDate },
    endsAt: { $gt: asOfDate },
  };

  const scopeConditions = [{ scope: DISCOUNT_SCOPES.ALL }];

  if (productId) {
    scopeConditions.push({
      scope: DISCOUNT_SCOPES.PRODUCTS,
      productIds: productId,
    });
  }

  if (variantId) {
    scopeConditions.push({
      scope: DISCOUNT_SCOPES.VARIANTS,
      variantIds: variantId,
    });
  }

  if (categoryId) {
    scopeConditions.push({
      scope: DISCOUNT_SCOPES.CATEGORIES,
      categoryIds: categoryId,
    });
  }

  if (brandId) {
    scopeConditions.push({
      scope: DISCOUNT_SCOPES.BRANDS,
      brandIds: brandId,
    });
  }

  query.$or = scopeConditions;

  return ProductDiscount.find(query)
    .sort({ priority: -1, createdAt: 1 })
    .session(options.session || null);
};

module.exports = {
  create,
  findById,
  findMany,
  updateById,
  deleteById,
  findEligibleDiscounts,
};
