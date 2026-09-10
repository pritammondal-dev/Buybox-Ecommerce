const mongoose = require("mongoose");

const wishlistRepository = require("../repositories/wishlist.repository");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Customer = require("../models/Customer");
const AppError = require("../errors/AppError");

const validateCustomer = async (userId) => {
  const customer = await Customer.findOne({
    userId,
    isActive: true,
    deletedAt: null,
  });

  if (!customer) {
    throw new AppError(
      "Customer profile not found",
      404,
      "CUSTOMER_NOT_FOUND"
    );
  }

  return customer;
};

const validateProduct = async (productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError(
      "Invalid product ID",
      400,
      "INVALID_PRODUCT_ID"
    );
  }

  const product = await Product.findOne({
    _id: productId,
    status: "active",
    deletedAt: null,
  });

  if (!product) {
    throw new AppError(
      "Product not found or unavailable",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  return product;
};

const validateVariant = async (productVariantId, productId) => {
  if (!mongoose.Types.ObjectId.isValid(productVariantId)) {
    throw new AppError(
      "Invalid product variant ID",
      400,
      "INVALID_PRODUCT_VARIANT_ID"
    );
  }

  const variant = await ProductVariant.findOne({
    _id: productVariantId,
    isActive: true,
    deletedAt: null,
  });

  if (!variant) {
    throw new AppError(
      "Product variant not found or unavailable",
      404,
      "PRODUCT_VARIANT_NOT_FOUND"
    );
  }

  if (variant.productId.toString() !== productId.toString()) {
    throw new AppError(
      "Product variant does not belong to the specified product",
      400,
      "INVALID_PRODUCT_VARIANT"
    );
  }

  return variant;
};

const getOrCreateWishlist = async (customerId, options = {}) => {
  let wishlist = await wishlistRepository.findByCustomerId(customerId, options);

  if (!wishlist) {
    try {
      wishlist = await wishlistRepository.create({
        customerId,
        items: [],
      });
    } catch (error) {
      if (error?.code === 11000) {
        wishlist = await wishlistRepository.findByCustomerId(customerId, options);
      }

      if (!wishlist) {
        throw error;
      }
    }
  }

  return wishlist;
};

const getWishlist = async (userId) => {
  const customer = await validateCustomer(userId);
  return getOrCreateWishlist(customer._id, { populate: true });
};

const addItem = async (userId, { productId, productVariantId = null }) => {
  const customer = await validateCustomer(userId);
  const product = await validateProduct(productId);

  if (productVariantId) {
    await validateVariant(productVariantId, product._id);
  }

  const wishlist = await getOrCreateWishlist(customer._id);

  const isDuplicate = wishlist.items.some((item) => {
    const sameProduct = item.productId.toString() === product._id.toString();
    const existingVariant = item.productVariantId
      ? item.productVariantId.toString()
      : null;
    const targetVariant = productVariantId
      ? productVariantId.toString()
      : null;

    return sameProduct && existingVariant === targetVariant;
  });

  if (isDuplicate) {
    throw new AppError(
      "Item is already in your wishlist",
      409,
      "WISHLIST_ITEM_ALREADY_EXISTS"
    );
  }

  wishlist.items.push({
    productId: product._id,
    productVariantId: productVariantId || null,
    addedAt: new Date(),
  });

  return wishlistRepository.updateById(wishlist._id, wishlist);
};

const removeItem = async (userId, itemId) => {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new AppError(
      "Invalid wishlist item ID",
      400,
      "INVALID_ITEM_ID"
    );
  }

  const customer = await validateCustomer(userId);
  const wishlist = await getOrCreateWishlist(customer._id);

  const itemIndex = wishlist.items.findIndex(
    (item) => item._id.toString() === itemId.toString()
  );

  if (itemIndex === -1) {
    throw new AppError(
      "Wishlist item not found",
      404,
      "WISHLIST_ITEM_NOT_FOUND"
    );
  }

  wishlist.items.splice(itemIndex, 1);
  return wishlistRepository.updateById(wishlist._id, wishlist);
};

const clearWishlist = async (userId) => {
  const customer = await validateCustomer(userId);
  const wishlist = await getOrCreateWishlist(customer._id);

  wishlist.items = [];
  return wishlistRepository.updateById(wishlist._id, wishlist);
};

module.exports = {
  getWishlist,
  addItem,
  removeItem,
  clearWishlist,
};
