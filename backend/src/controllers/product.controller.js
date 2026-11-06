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

const isPrivilegedActor = (user) => {
  if (!user) return false;
  return (
    ["admin", "super_admin", "manager"].includes(user.role) ||
    user.role === "editor" ||
    user.context === "administrator" ||
    user.employee != null ||
    user.roles?.some?.((r) => ["admin", "super_admin", "manager"].includes(r) || r === "editor") ||
    user.role === "vendor" ||
    user.context === "vendor"
  );
};

const sanitizeProductForCustomer = (product) => {
  if (!product) return product;
  const p = product.toObject ? product.toObject() : { ...product };
  delete p.sku;
  if (p.defaultVariant) {
    const dv = p.defaultVariant.toObject ? p.defaultVariant.toObject() : { ...p.defaultVariant };
    delete dv.sku;
    p.defaultVariant = dv;
  }
  if (Array.isArray(p.variants)) {
    p.variants = p.variants.map((v) => {
      const vObj = v.toObject ? v.toObject() : { ...v };
      delete vObj.sku;
      return vObj;
    });
  }
  return p;
};

const getProduct = asyncHandler(async (req, res) => {
  const isPrivileged = isPrivilegedActor(req.user);

  const product = await productService.getProductById(
    req.params.id,
    {
      actor: req.user || null,
      publicOnly: !isPrivileged,
    }
  );

  const finalProduct = isPrivileged ? product : sanitizeProductForCustomer(product);

  return sendSuccess(res, {
    message: "Product retrieved successfully",
    data: { product: finalProduct },
  });
});

const adminGetProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(
    req.params.id,
    {
      actor: req.user,
      publicOnly: false,
      includeInactiveVariants: true,
    }
  );

  return sendSuccess(res, {
    message: "Admin product retrieved successfully",
    data: { product },
  });
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(
    req.params.slug
  );

  const isPrivileged = isPrivilegedActor(req.user);
  const finalProduct = isPrivileged ? product : sanitizeProductForCustomer(product);

  return sendSuccess(res, {
    message: "Product retrieved successfully",
    data: { product: finalProduct },
  });
});

const getVariantAvailability = asyncHandler(async (req, res) => {
  const availability = await productService.getVariantAvailability(
    req.params.variantId
  );

  return sendSuccess(res, {
    message: "Variant availability retrieved successfully",
    data: availability,
  });
});

const listProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts({
    ...req.query,
    actor: req.user || null,
  });

  const isPrivileged = isPrivilegedActor(req.user);
  const items = isPrivileged
    ? result.items
    : (result.items || []).map(sanitizeProductForCustomer);

  return sendSuccess(res, {
    message: "Products retrieved successfully",
    data: items,
    meta: result.meta,
  });
});

const adminListProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts({
    ...req.query,
    actor: req.user,
  });

  return sendSuccess(res, {
    message: "Admin products retrieved successfully",
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
    req,
  });

  return sendSuccess(res, {
    message: "Product archived successfully",
    data: null,
  });
});

const restoreProduct = asyncHandler(async (req, res) => {
  const product = await productService.restoreProduct({
    id: req.params.id,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    message: "Product restored successfully",
    data: { product },
  });
});

const adminBulkOperations = asyncHandler(async (req, res) => {
  const result = await productService.adminBulkOperations({
    productIds: req.body.productIds,
    action: req.body.action,
    reason: req.body.reason,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    message: "Bulk operations completed successfully",
    data: result,
  });
});
const listMyProducts = asyncHandler(async (req, res) => {
  const result = await productService.listMyProducts({
    userId: req.user.id,
    vendorId: req.vendor?._id,
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    search: req.query.search,
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

  const isPrivileged = isPrivilegedActor(req.user);
  const data = isPrivileged ? products : products.map(sanitizeProductForCustomer);

  return sendSuccess(res, {
    message: "Recommended products retrieved successfully",
    data,
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

  const isPrivileged = isPrivilegedActor(req.user);
  const data = isPrivileged ? related : related.map(sanitizeProductForCustomer);

  return sendSuccess(res, {
    message: "Related products retrieved successfully",
    data,
  });
});

const downloadImportTemplate = asyncHandler(async (req, res) => {
  const rawFormat = String(req.query.format || "csv").toLowerCase().trim();
  const format = rawFormat === "excel" ? "xlsx" : rawFormat;
  const { buffer, filename, contentType } =
    bulkImportExportService.generateImportTemplate(format);

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.status(200).send(buffer);
});

const validateBulkImport = asyncHandler(async (req, res) => {
  const spreadsheetFile = req.file || (req.files && req.files.file && req.files.file[0]);
  if (!spreadsheetFile) {
    return res.status(400).json({
      success: false,
      code: "FILE_REQUIRED",
      message: "Please upload a CSV or XLSX spreadsheet file.",
    });
  }

  const imagesZip = req.files && req.files.images && req.files.images[0];
  const vendorId = req.vendor?._id;
  const report = await bulkImportExportService.validateBulkImport({
    buffer: spreadsheetFile.buffer,
    filename: spreadsheetFile.originalname,
    vendorId,
    actor: req.user,
    imagesZipBuffer: imagesZip ? imagesZip.buffer : null,
    imagesZipFilename: imagesZip ? imagesZip.originalname : null,
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
    stagingId: req.body.stagingId,
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

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const AppError = require("../errors/AppError");

const getJob = asyncHandler(async (req, res) => {
  const job = await bulkImportExportService.getJobById(req.params.jobId, req.user);
  return sendSuccess(res, {
    data: { job },
  });
});

const uploadProductImage = asyncHandler(async (req, res) => {
  const file = req.file || req.files?.image?.[0] || req.files?.file?.[0];
  if (!file) {
    throw new AppError("No image file provided", 400, "MISSING_IMAGE_FILE");
  }

  const { originalname, mimetype, size, buffer } = file;
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
  if (!allowedMimes.includes(mimetype.toLowerCase())) {
    throw new AppError("Invalid image type. Allowed formats: JPEG, PNG, WEBP, GIF, AVIF", 400, "INVALID_IMAGE_TYPE");
  }

  const ext = path.extname(originalname).toLowerCase();
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
  if (!allowedExts.includes(ext)) {
    throw new AppError("Invalid file extension. Allowed formats: JPG, JPEG, PNG, WEBP, GIF, AVIF", 400, "INVALID_FILE_EXTENSION");
  }

  const storageService = require("../services/storage");
  const safeFilename = `product_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;

  const storageResult = await storageService.uploadPublicMedia({
    filename: safeFilename,
    buffer,
    mimeType: mimetype,
    prefix: "uploads",
  });

  const fileUrl = storageResult.url;
  const altText = originalname.replace(ext, "").replace(/[-_]+/g, " ");

  return sendSuccess(res, {
    statusCode: 201,
    message: "Image uploaded successfully",
    data: {
      url: fileUrl,
      altText,
      filename: safeFilename,
      size,
      storageProvider: storageResult.storageProvider,
    },
  });
});

const uploadDigitalAsset = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({
      success: false,
      code: "FILE_REQUIRED",
      message: "Please upload a valid digital file.",
    });
  }

  const digitalStorageService = require("../services/digital-storage.service");
  const asset = await digitalStorageService.saveDigitalAsset(file, {
    version: req.body.version || "1.0",
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Digital asset uploaded successfully",
    data: {
      file: {
        id: asset.id,
        name: asset.name,
        fileName: asset.fileName,
        storageKey: asset.storageKey,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        version: asset.version,
        uploadedAt: asset.uploadedAt,
        fileUrl: `digital://${asset.storageKey}`,
      },
    },
  });
});

module.exports = {
  createProduct,
  getProduct,
  adminGetProduct,
  getProductBySlug,
  getVariantAvailability,
  listProducts,
  adminListProducts,
  listMyProducts,
  updateProduct,
  deleteProduct,
  restoreProduct,
  adminBulkOperations,
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
  uploadProductImage,
  uploadDigitalAsset,
};

