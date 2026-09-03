const brandRepository = require("../repositories/brand.repository");
const AppError = require("../errors/AppError");

const createBrand = async (data) => {
  const existingSlug = await brandRepository.findBySlug(
    data.slug
  );

  if (existingSlug) {
    throw new AppError(
      "Brand slug already exists",
      409,
      "BRAND_SLUG_ALREADY_EXISTS"
    );
  }

  return brandRepository.create(data);
};

const getBrandById = async (id) => {
  const brand = await brandRepository.findById(id);

  if (!brand) {
    throw new AppError(
      "Brand not found",
      404,
      "BRAND_NOT_FOUND"
    );
  }

  return brand;
};

const listBrands = async ({
  page = 1,
  limit = 20,
  isActive,
}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    100
  );

  const filter = {
  isActive: true,
};

  if (isActive !== undefined) {
    filter.isActive = isActive === true || isActive === "true";
  }

  const result = await brandRepository.list({
    filter,
    skip: (safePage - 1) * safeLimit,
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

const updateBrand = async (id, data) => {
  const brand = await brandRepository.findById(id);

  if (!brand) {
    throw new AppError(
      "Brand not found",
      404,
      "BRAND_NOT_FOUND"
    );
  }

  if (data.slug && data.slug !== brand.slug) {
    const existingSlug =
      await brandRepository.findBySlug(data.slug);

    if (existingSlug) {
      throw new AppError(
        "Brand slug already exists",
        409,
        "BRAND_SLUG_ALREADY_EXISTS"
      );
    }
  }

  return brandRepository.updateById(id, data);
};

const deleteBrand = async (id) => {
  const brand = await brandRepository.findById(id);

  if (!brand) {
    throw new AppError(
      "Brand not found",
      404,
      "BRAND_NOT_FOUND"
    );
  }

  return brandRepository.softDeleteById(id);
};

module.exports = {
  createBrand,
  getBrandById,
  listBrands,
  updateBrand,
  deleteBrand,
};