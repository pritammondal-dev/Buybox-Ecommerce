const productRepository = require("../repositories/product.repository");
const categoryRepository = require("../repositories/category.repository");
const brandRepository = require("../repositories/brand.repository");
const AppError = require("../errors/AppError");

const createProduct = async ({
  data,
  vendorId,
}) => {
  const existingSku = await productRepository.findBySku(data.sku);

  if (existingSku) {
    throw new AppError(
      "Product SKU already exists",
      409,
      "PRODUCT_SKU_ALREADY_EXISTS"
    );
  }

  const existingSlug = await productRepository.findBySlug(data.slug);

  if (existingSlug) {
    throw new AppError(
      "Product slug already exists",
      409,
      "PRODUCT_SLUG_ALREADY_EXISTS"
    );
  }

  const category = await categoryRepository.findById(
    data.categoryId
  );

  if (!category || !category.isActive) {
    throw new AppError(
      "Category not found or inactive",
      400,
      "INVALID_CATEGORY"
    );
  }

  if (data.brandId) {
    const brand = await brandRepository.findById(data.brandId);

    if (!brand || !brand.isActive) {
      throw new AppError(
        "Brand not found or inactive",
        400,
        "INVALID_BRAND"
      );
    }
  }

  return productRepository.create({
    ...data,
    vendorId,
  });
};

const getProductById = async (id) => {
  const product = await productRepository.findById(id, {
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
  const product = await productRepository.findBySlug(slug, {
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
  const safePage = Math.max(Number(page) || 1, 1);
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

  const skip = (safePage - 1) * safeLimit;

  const result = await productRepository.list({
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
      totalPages: Math.ceil(result.total / safeLimit),
    },
  };
};

const updateProduct = async ({
  id,
  data,
  actor,
}) => {
  const product = await productRepository.findById(id);

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  const privilegedRoles = [
    "admin",
    "super_admin",
    "manager",
  ];

  const isPrivileged = privilegedRoles.includes(actor.role);

  if (
    !isPrivileged &&
    product.vendorId.toString() !== actor.id.toString()
  ) {
    throw new AppError(
      "You do not own this product",
      403,
      "PRODUCT_OWNERSHIP_REQUIRED"
    );
  }

  if (data.sku && data.sku !== product.sku) {
    const existingSku = await productRepository.findBySku(
      data.sku
    );

    if (existingSku) {
      throw new AppError(
        "Product SKU already exists",
        409,
        "PRODUCT_SKU_ALREADY_EXISTS"
      );
    }
  }

  if (data.slug && data.slug !== product.slug) {
    const existingSlug =
      await productRepository.findBySlug(data.slug);

    if (existingSlug) {
      throw new AppError(
        "Product slug already exists",
        409,
        "PRODUCT_SLUG_ALREADY_EXISTS"
      );
    }
  }

  if (data.categoryId) {
    const category = await categoryRepository.findById(
      data.categoryId
    );

    if (!category || !category.isActive) {
      throw new AppError(
        "Category not found or inactive",
        400,
        "INVALID_CATEGORY"
      );
    }
  }

  if (data.brandId) {
    const brand = await brandRepository.findById(
      data.brandId
    );

    if (!brand || !brand.isActive) {
      throw new AppError(
        "Brand not found or inactive",
        400,
        "INVALID_BRAND"
      );
    }
  }

  return productRepository.updateById(id, data);
};

const deleteProduct = async ({
  id,
  actor,
}) => {
  const product = await productRepository.findById(id);

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  const privilegedRoles = [
    "admin",
    "super_admin",
    "manager",
  ];

  const isPrivileged = privilegedRoles.includes(actor.role);

  if (
    !isPrivileged &&
    product.vendorId.toString() !== actor.id.toString()
  ) {
    throw new AppError(
      "You do not own this product",
      403,
      "PRODUCT_OWNERSHIP_REQUIRED"
    );
  }

  return productRepository.softDeleteById(id);
};
module.exports = {
  createProduct,
  getProductById,
  getProductBySlug,
  listProducts,
  updateProduct,
  deleteProduct,
};