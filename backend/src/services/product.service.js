const productRepository = require("../repositories/product.repository");
const categoryRepository = require("../repositories/category.repository");
const brandRepository = require("../repositories/brand.repository");
const AppError = require("../errors/AppError");
const Vendor = require("../models/Vendor");

const PRIVILEGED_ROLES = [
  "admin",
  "super_admin",
  "manager",
];

const getVendorIdByUserId = async (userId) => {
  const vendor = await Vendor.findOne({
    userId,
    isActive: true,
    deletedAt: null,
  });

  if (!vendor) {
    throw new AppError(
      "Vendor profile not found",
      404,
      "VENDOR_NOT_FOUND"
    );
  }

  return vendor._id;
};

const resolveActorVendorId = async (actor) => {
  if (PRIVILEGED_ROLES.includes(actor.role)) {
    return null;
  }

  if (actor.role !== "vendor") {
    throw new AppError(
      "You do not have permission to manage products",
      403,
      "INSUFFICIENT_PERMISSIONS"
    );
  }

  return getVendorIdByUserId(actor.id);
};

const ensureProductOwnership = async (product, actor) => {
  const actorVendorId = await resolveActorVendorId(actor);

  if (
    actorVendorId &&
    (!product.vendorId ||
      product.vendorId.toString() !==
        actorVendorId.toString())
  ) {
    throw new AppError(
      "You do not own this product",
      403,
      "PRODUCT_OWNERSHIP_REQUIRED"
    );
  }

  return actorVendorId;
};

const validateCategory = async (categoryId) => {
  const category =
    await categoryRepository.findById(categoryId);

  if (!category || !category.isActive) {
    throw new AppError(
      "Category not found or inactive",
      400,
      "INVALID_CATEGORY"
    );
  }

  return category;
};

const validateBrand = async (brandId) => {
  if (!brandId) {
    return null;
  }

  const brand =
    await brandRepository.findById(brandId);

  if (!brand || !brand.isActive) {
    throw new AppError(
      "Brand not found or inactive",
      400,
      "INVALID_BRAND"
    );
  }

  return brand;
};

const ensureUniqueSku = async (sku, currentProductId = null) => {
  const existingProduct =
    await productRepository.findBySku(sku);

  if (
    existingProduct &&
    (!currentProductId ||
      existingProduct._id.toString() !==
        currentProductId.toString())
  ) {
    throw new AppError(
      "Product SKU already exists",
      409,
      "PRODUCT_SKU_ALREADY_EXISTS"
    );
  }
};

const ensureUniqueSlug = async (
  slug,
  currentProductId = null
) => {
  const existingProduct =
    await productRepository.findBySlug(slug);

  if (
    existingProduct &&
    (!currentProductId ||
      existingProduct._id.toString() !==
        currentProductId.toString())
  ) {
    throw new AppError(
      "Product slug already exists",
      409,
      "PRODUCT_SLUG_ALREADY_EXISTS"
    );
  }
};

const createProduct = async ({
  data,
  userId,
}) => {
  await ensureUniqueSku(data.sku);
  await ensureUniqueSlug(data.slug);

  await validateCategory(data.categoryId);
  await validateBrand(data.brandId);

  const vendorId =
    await getVendorIdByUserId(userId);

  return productRepository.create({
    ...data,
    vendorId,
  });
};

const getProductById = async (id) => {
  const product =
    await productRepository.findById(id, {
      publicOnly: true,
    });

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  return product;
};

const getProductBySlug = async (slug) => {
  const product =
    await productRepository.findBySlug(slug, {
      publicOnly: true,
    });

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  return product;
};

const listProducts = async ({
  page = 1,
  limit = 20,
  categoryId,
  brandId,
  vendorId,
  search,
}) => {
  const safePage = Math.max(
    Number(page) || 1,
    1
  );

  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    100
  );

  const filter = {
    status: "active",
  };

  if (categoryId) {
    filter.categoryId = categoryId;
  }

  if (brandId) {
    filter.brandId = brandId;
  }

  if (vendorId) {
    filter.vendorId = vendorId;
  }

  if (search) {
    filter.$text = {
      $search: search,
    };
  }

  const skip =
    (safePage - 1) * safeLimit;

  const result =
    await productRepository.list({
      filter,
      skip,
      limit: safeLimit,
    });

  return {
    items: result.items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total: result.total,
      totalPages: Math.ceil(
        result.total / safeLimit
      ),
    },
  };
};

const updateProduct = async ({
  id,
  data,
  actor,
}) => {
  const product =
    await productRepository.findById(id);

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  await ensureProductOwnership(
    product,
    actor
  );

  if (
    data.sku &&
    data.sku !== product.sku
  ) {
    await ensureUniqueSku(
      data.sku,
      product._id
    );
  }

  if (
    data.slug &&
    data.slug !== product.slug
  ) {
    await ensureUniqueSlug(
      data.slug,
      product._id
    );
  }

  if (data.categoryId) {
    await validateCategory(
      data.categoryId
    );
  }

  if (data.brandId) {
    await validateBrand(
      data.brandId
    );
  }

  /*
   * Vendor ownership is immutable.
   * Never allow a vendor to transfer a product
   * to another vendor through the update payload.
   */
  const safeData = {
    ...data,
  };

  delete safeData.vendorId;

  return productRepository.updateById(
    id,
    safeData
  );
};

const deleteProduct = async ({
  id,
  actor,
}) => {
  const product =
    await productRepository.findById(id);

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  await ensureProductOwnership(
    product,
    actor
  );

  return productRepository.softDeleteById(id);
};

module.exports = {
  createProduct,
  getProductById,
  getProductBySlug,
  listProducts,
  updateProduct,
  deleteProduct,
  getVendorIdByUserId,
};