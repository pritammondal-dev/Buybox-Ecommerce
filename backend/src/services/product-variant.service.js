const productVariantRepository = require("../repositories/product-variant.repository");
const productRepository = require("../repositories/product.repository");
const {
  ensureProductOwnership,
} = require("./product.service");
const AppError = require("../errors/AppError");

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

  await ensureProductOwnership(product, actor);

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

  await ensureProductOwnership(product, actor);

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

  await ensureProductOwnership(product, actor);

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

  await ensureProductOwnership(product, actor);

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

  const safeData = {
    ...data,
  };
  delete safeData.productId;

  return productVariantRepository.updateById(
    id,
    safeData
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

  await ensureProductOwnership(product, actor);

  return productVariantRepository.softDeleteById(id);
};

module.exports = {
  createProductVariant,
  getProductVariant,
  listProductVariants,
  updateProductVariant,
  deleteProductVariant,
};