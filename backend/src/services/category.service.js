const categoryRepository = require("../repositories/category.repository");
const AppError = require("../errors/AppError");

const wouldCreateCategoryCycle = async (
  categoryId,
  newParentId
) => {
  let currentParentId = newParentId;

  while (currentParentId) {
    if (currentParentId.toString() === categoryId.toString()) {
      return true;
    }

    const parentCategory =
      await categoryRepository.findById(currentParentId);

    if (!parentCategory) {
      return false;
    }

    currentParentId = parentCategory.parentId;
  }

  return false;
};

const createCategory = async (data) => {
  const existingSlug = await categoryRepository.findBySlug(
    data.slug
  );

  if (existingSlug) {
    throw new AppError(
      "Category slug already exists",
      409,
      "CATEGORY_SLUG_ALREADY_EXISTS"
    );
  }

  if (data.parentId) {
    const parent = await categoryRepository.findById(
      data.parentId
    );

    if (!parent || !parent.isActive) {
      throw new AppError(
        "Parent category not found or inactive",
        400,
        "INVALID_PARENT_CATEGORY"
      );
    }
  }

  return categoryRepository.create(data);
};

const getCategoryById = async (id) => {
  const category = await categoryRepository.findById(id);

  if (!category) {
    throw new AppError(
      "Category not found",
      404,
      "CATEGORY_NOT_FOUND"
    );
  }

  return category;
};

const listCategories = async ({
  page = 1,
  limit = 20,
  parentId,
}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    100
  );

 const filter = {
  isActive: true,
};

  if (parentId) {
    filter.parentId = parentId;
  }

  const result = await categoryRepository.list({
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

const updateCategory = async (id, data) => {
  const category = await categoryRepository.findById(id);

  if (!category) {
    throw new AppError(
      "Category not found",
      404,
      "CATEGORY_NOT_FOUND"
    );
  }

  if (data.slug && data.slug !== category.slug) {
    const existingSlug =
      await categoryRepository.findBySlug(data.slug);

    if (existingSlug) {
      throw new AppError(
        "Category slug already exists",
        409,
        "CATEGORY_SLUG_ALREADY_EXISTS"
      );
    }
  }

  if (data.parentId) {
    if (data.parentId.toString() === id.toString()) {
      throw new AppError(
        "Category cannot be its own parent",
        400,
        "INVALID_PARENT_CATEGORY"
      );
    }

    const parent = await categoryRepository.findById(
      data.parentId
    );

    if (!parent || !parent.isActive) {
      throw new AppError(
        "Parent category not found or inactive",
        400,
        "INVALID_PARENT_CATEGORY"
      );
    }
  }

  if (data.parentId) {
  const createsCycle = await wouldCreateCategoryCycle(
    id,
    data.parentId
  );

  if (createsCycle) {
    throw new AppError(
      "Category hierarchy would create a cycle",
      400,
      "CATEGORY_CYCLE_DETECTED"
    );
  }
}

  return categoryRepository.updateById(id, data);
};

const deleteCategory = async (id) => {
  const category = await categoryRepository.findById(id);

  if (!category) {
    throw new AppError(
      "Category not found",
      404,
      "CATEGORY_NOT_FOUND"
    );
  }

  return categoryRepository.softDeleteById(id);
};

module.exports = {
  createCategory,
  getCategoryById,
  listCategories,
  updateCategory,
  deleteCategory,
};