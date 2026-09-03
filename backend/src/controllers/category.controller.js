const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const categoryService = require("../services/category.service");

const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Category created successfully",
    data: { category },
  });
});

const getCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(
    req.params.id
  );

  return sendSuccess(res, {
    message: "Category retrieved successfully",
    data: { category },
  });
});

const listCategories = asyncHandler(async (req, res) => {
  const result = await categoryService.listCategories(
    req.query
  );

  return sendSuccess(res, {
    message: "Categories retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(
    req.params.id,
    req.body
  );

  return sendSuccess(res, {
    message: "Category updated successfully",
    data: { category },
  });
});

const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);

  return sendSuccess(res, {
    message: "Category deleted successfully",
    data: null,
  });
});

module.exports = {
  createCategory,
  getCategory,
  listCategories,
  updateCategory,
  deleteCategory,
};