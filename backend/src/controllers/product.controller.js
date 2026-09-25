const asyncHandler = require("../utils/asyncHandler");

const { sendSuccess } = require("../utils/apiResponse");

const productService = require("../services/product.service");
const bulkImportExportService = require("../services/bulk-import-export.service");

const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct({
    data: req.body,
    userId: req.user.id,
    actor: req.user,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Product created successfully",
    data: { product },
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(
    req.params.id
  );

  return sendSuccess(res, {
    message: "Product retrieved successfully",
    data: { product },
  });
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(
    req.params.slug
  );

  return sendSuccess(res, {
    message: "Product retrieved successfully",
    data: { product },
  });
});

const listProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(
    req.query
  );

  return sendSuccess(res, {
    message: "Products retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct({
    id: req.params.id,
    data: req.body,
    actor: req.user,
  });

  return sendSuccess(res, {
    message: "Product updated successfully",
    data: { product },
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct({
    id: req.params.id,
    actor: req.user,
  });

  return sendSuccess(res, {
    message: "Product deleted successfully",
    data: null,
  });
});
const listMyProducts = asyncHandler(async (req, res) => {
  const result = await productService.listMyProducts({
    userId: req.user.id,
    vendorId: req.vendor?._id,
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
  });

  return sendSuccess(res, {
    message: "Vendor products retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
});

const submitProductForApproval = asyncHandler(async (req, res) => {
  const product = await productService.submitProductForApproval({
    id: req.params.id,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    message: "Product submitted for approval successfully",
    data: { product },
  });
});

const approveProduct = asyncHandler(async (req, res) => {
  const product = await productService.approveProduct({
    id: req.params.id,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    message: "Product approved successfully",
    data: { product },
  });
});

const rejectProduct = asyncHandler(async (req, res) => {
  const product = await productService.rejectProduct({
    id: req.params.id,
    reason: req.body.reason,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    message: "Product rejected successfully",
    data: { product },
  });
});

const Product = require("../models/Product");

const getRecommendations = asyncHandler(async (req, res) => {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
  const products = await Product.find({ status: "active" })
    .sort({ isFeatured: -1, ratingAverage: -1, ratingCount: -1 })
    .limit(limit)
    .lean();

  return sendSuccess(res, {
    message: "Recommended products retrieved successfully",
    data: products,
  });
});

const getRelatedProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 6));

  const target = await Product.findById(id).select("categoryId brandId tags").lean();
  if (!target) {
    return sendSuccess(res, {
      message: "Related products retrieved",
      data: [],
    });
  }

  const query = {
    _id: { $ne: target._id },
    status: "active",
    $or: [
      { categoryId: target.categoryId },
      { brandId: target.brandId },
      ...(Array.isArray(target.tags) && target.tags.length > 0 ? [{ tags: { $in: target.tags } }] : []),
    ],
  };

  const related = await Product.find(query)
    .sort({ ratingAverage: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return sendSuccess(res, {
    message: "Related products retrieved successfully",
    data: related,
  });
});

const downloadImportTemplate = asyncHandler(async (req, res) => {
  const format = req.query.format || "csv";
  const { buffer, filename, contentType } =
    bulkImportExportService.generateImportTemplate(format);

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(buffer);
});

const validateBulkImport = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      code: "FILE_REQUIRED",
      message: "Please upload a CSV or XLSX spreadsheet file.",
    });
  }

  const vendorId = req.vendor?._id;
  const report = await bulkImportExportService.validateBulkImport({
    buffer: req.file.buffer,
    filename: req.file.originalname,
    vendorId,
  });

  return sendSuccess(res, {
    message: "Bulk product import file validated successfully",
    data: report,
  });
});

const commitBulkImport = asyncHandler(async (req, res) => {
  const vendorId = req.vendor?._id;
  const result = await bulkImportExportService.commitBulkImport({
    rows: req.body.rows,
    vendorId,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Bulk products imported successfully",
    data: result,
  });
});

const exportMyProducts = asyncHandler(async (req, res) => {
  const vendorId = req.vendor?._id;
  const { buffer, filename, contentType, count } =
    await bulkImportExportService.exportVendorProducts({
      vendorId,
      filters: req.query,
      format: req.query.format || "csv",
      actor: req.user,
      req,
    });

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Export-Count", count);
  return res.send(buffer);
});

const duplicateProduct = asyncHandler(async (req, res) => {
  const product = await productService.duplicateProduct({
    id: req.params.id,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Product duplicated successfully",
    data: { product },
  });
});

const downloadErrorReport = asyncHandler(async (req, res) => {
  const format = req.query.format || "csv";
  const { buffer, filename, contentType } =
    bulkImportExportService.generateErrorReport({
      errorDetails: req.body.errorDetails,
      format,
    });

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(buffer);
});

const exportInventory = asyncHandler(async (req, res) => {
  const vendorId = req.vendor?._id || req.query.vendorId;
  const { buffer, filename, contentType, count } =
    await bulkImportExportService.exportInventory({
      vendorId,
      warehouseId: req.query.warehouseId,
      format: req.query.format || "csv",
      actor: req.user,
      req,
    });

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Export-Count", count);
  return res.send(buffer);
});

const bulkUpdatePricesAndStock = asyncHandler(async (req, res) => {
  const vendorId = req.vendor?._id;
  const result = await bulkImportExportService.bulkUpdatePricesAndStock({
    updates: req.body.updates,
    vendorId,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    message: "Bulk prices and stock updated successfully",
    data: result,
  });
});

const listJobs = asyncHandler(async (req, res) => {
  const result = await bulkImportExportService.listJobs({
    vendorId: req.vendor?._id,
    scope: req.query.scope,
    page: req.query.page,
    limit: req.query.limit,
    actor: req.user,
  });

  return sendSuccess(res, {
    data: result,
  });
});

const getJob = asyncHandler(async (req, res) => {
  const job = await bulkImportExportService.getJobById(req.params.jobId, req.user);
  return sendSuccess(res, {
    data: { job },
  });
});

module.exports = {
  createProduct,
  getProduct,
  getProductBySlug,
  listProducts,
  listMyProducts,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  submitProductForApproval,
  approveProduct,
  rejectProduct,
  getRecommendations,
  getRelatedProducts,
  downloadImportTemplate,
  validateBulkImport,
  commitBulkImport,
  exportMyProducts,
  downloadErrorReport,
  exportInventory,
  bulkUpdatePricesAndStock,
  listJobs,
  getJob,
};

