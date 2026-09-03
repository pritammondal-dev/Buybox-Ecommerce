const productVariantRepository = require("../repositories/product-variant.repository");
const productRepository = require("../repositories/product.repository");
const AppError = require("../errors/AppError");

const PRIVILEGED_ROLES = [
  "admin",
  "super_admin",
  "manager",
];

const canManageProduct = (product, actor) => {
  if (PRIVILEGED_ROLES.includes(actor.role)) {
    return true;
  }

  return (
    product.vendorId.toString() === actor.id.toString()
  );
};

const createProductVariant = async ({
  data,
  actor,
}) => {
  const product = await productRepository.findById(
    data.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  if (!canManageProduct(product, actor)) {
    throw new AppError(
      "You do not own this product",
      403,
      "PRODUCT_OWNERSHIP_REQUIRED"
    );
  }

  const existingSku =
    await productVariantRepository.findBySku(data.sku);

  if (existingSku) {
    throw new AppError(
      "Product variant SKU already exists",
      409,
      "VARIANT_SKU_ALREADY_EXISTS"
    );
  }

  return productVariantRepository.create(data);
};

const getProductVariant = async ({
  id,
  actor,
}) => {
  const variant =
    await productVariantRepository.findById(id);

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "VARIANT_NOT_FOUND"
    );
  }

  const product = await productRepository.findById(
    variant.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  if (!canManageProduct(product, actor)) {
    throw new AppError(
      "You do not own this product",
      403,
      "PRODUCT_OWNERSHIP_REQUIRED"
    );
  }

  return variant;
};

const listProductVariants = async ({
  productId,
  actor,
}) => {
  const product = await productRepository.findById(
    productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  if (!canManageProduct(product, actor)) {
    throw new AppError(
      "You do not own this product",
      403,
      "PRODUCT_OWNERSHIP_REQUIRED"
    );
  }

  return productVariantRepository.findByProductId(
    productId
  );
};

const updateProductVariant = async ({
  id,
  data,
  actor,
}) => {
  const variant =
    await productVariantRepository.findById(id);

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "VARIANT_NOT_FOUND"
    );
  }

  const product = await productRepository.findById(
    variant.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  if (!canManageProduct(product, actor)) {
    throw new AppError(
      "You do not own this product",
      403,
      "PRODUCT_OWNERSHIP_REQUIRED"
    );
  }

  if (data.sku && data.sku !== variant.sku) {
    const existingSku =
      await productVariantRepository.findBySku(
        data.sku
      );

    if (existingSku) {
      throw new AppError(
        "Product variant SKU already exists",
        409,
        "VARIANT_SKU_ALREADY_EXISTS"
      );
    }
  }

  return productVariantRepository.updateById(
    id,
    data
  );
};

const deleteProductVariant = async ({
  id,
  actor,
}) => {
  const variant =
    await productVariantRepository.findById(id);

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "VARIANT_NOT_FOUND"
    );
  }

  const product = await productRepository.findById(
    variant.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  if (!canManageProduct(product, actor)) {
    throw new AppError(
      "You do not own this product",
      403,
      "PRODUCT_OWNERSHIP_REQUIRED"
    );
  }

  return productVariantRepository.softDeleteById(id);
};

module.exports = {
  createProductVariant,
  getProductVariant,
  listProductVariants,
  updateProductVariant,
  deleteProductVariant,
};