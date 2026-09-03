const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const AppError = require("../errors/AppError");
const { ROLES } = require("../constants/auth.constants");

const ensureInventoryAccess = async ({
  user,
  productVariantId,
}) => {
  if (!user) {
    throw new AppError(
      "Authentication required",
      401,
      "AUTHENTICATION_REQUIRED"
    );
  }

  if (
    user.role === ROLES.ADMIN ||
    user.role === ROLES.SUPER_ADMIN ||
    user.role === ROLES.MANAGER
  ) {
    return;
  }

  if (user.role !== ROLES.VENDOR) {
    throw new AppError(
      "You do not have permission to manage this inventory",
      403,
      "INSUFFICIENT_PERMISSIONS"
    );
  }

  const variant = await ProductVariant.findById(
    productVariantId
  );

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "PRODUCT_VARIANT_NOT_FOUND"
    );
  }

  const product = await Product.findById(
    variant.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  if (
    !product.vendorId ||
    product.vendorId.toString() !== user.id.toString()
  ) {
    throw new AppError(
      "You do not have access to this inventory",
      403,
      "INVENTORY_ACCESS_DENIED"
    );
  }
};

const ensureInventoryIdAccess = async ({
  user,
  inventory,
}) => {
  return ensureInventoryAccess({
    user,
    productVariantId: inventory.productVariantId,
  });
};

module.exports = {
  ensureInventoryAccess,
  ensureInventoryIdAccess,
};