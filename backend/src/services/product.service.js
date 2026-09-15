const productRepository = require("../repositories/product.repository");
const categoryRepository = require("../repositories/category.repository");
const brandRepository = require("../repositories/brand.repository");
const AppError = require("../errors/AppError");
const Vendor = require("../models/Vendor");
const { recordAuditLog } = require("./governance.service");

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

  /*
   * Vendor-created products must always start as "draft".
   * Server strictly enforces initial draft status and clears approval metadata.
   */
  const safeData = {
    ...data,
    vendorId,
    status: "draft",
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    moderatedBy: null,
    rejectionReason: null,
  };

  return productRepository.create(safeData);
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
   * Approval metadata is strictly server-controlled.
   */
  const safeData = {
    ...data,
  };

  delete safeData.vendorId;
  delete safeData.submittedAt;
  delete safeData.approvedAt;
  delete safeData.rejectedAt;
  delete safeData.moderatedBy;
  delete safeData.rejectionReason;

  /*
   * Vendors cannot directly activate products or bypass approval.
   */
  if (safeData.status) {
    if (safeData.status === "active") {
      throw new AppError(
        "Vendors cannot directly activate products. Please submit for approval.",
        403,
        "DIRECT_ACTIVATION_FORBIDDEN"
      );
    }
    if (safeData.status === "pending_approval") {
      throw new AppError(
        "Please use the submit endpoint to submit a product for approval",
        400,
        "USE_SUBMIT_ENDPOINT"
      );
    }
    if (safeData.status === "rejected") {
      throw new AppError(
        "Vendors cannot reject products",
        403,
        "PRODUCT_REJECTION_FORBIDDEN"
      );
    }
  }

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

const listMyProducts = async ({
  userId,
  page = 1,
  limit = 20,
  status,
}) => {
  const vendorId = await getVendorIdByUserId(userId);

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const filter = {
    vendorId,
    deletedAt: null,
  };

  if (status) {
    filter.status = status;
  }

  const skip = (safePage - 1) * safeLimit;

  const result = await productRepository.list({
    filter,
    skip,
    limit: safeLimit,
    sort: { createdAt: -1 },
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

const submitProductForApproval = async ({
  id,
  actor,
  req = null,
}) => {
  const product = await productRepository.findById(id);

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  await ensureProductOwnership(product, actor);

  if (!["draft", "rejected"].includes(product.status)) {
    throw new AppError(
      `Product cannot be submitted for approval from status ${product.status}`,
      400,
      "INVALID_PRODUCT_STATUS"
    );
  }

  const isResubmission = product.status === "rejected";
  const beforeState = { status: product.status };

  const updatedProduct = await productRepository.updateById(id, {
    status: "pending_approval",
    submittedAt: new Date(),
    rejectionReason: null,
    rejectedAt: null,
  });

  await recordAuditLog({
    actorId: actor.id,
    targetId: product._id,
    action: isResubmission ? "product_resubmitted" : "product_submitted",
    entityType: "product",
    beforeState,
    afterState: {
      status: updatedProduct.status,
      submittedAt: updatedProduct.submittedAt,
    },
    req,
  });

  return updatedProduct;
};

const approveProduct = async ({
  id,
  actor,
  req = null,
}) => {
  const product = await productRepository.findById(id);

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  if (product.status !== "pending_approval") {
    throw new AppError(
      `Product cannot be approved from status ${product.status}. Must be pending_approval.`,
      400,
      "INVALID_PRODUCT_STATUS"
    );
  }

  const beforeState = { status: product.status };

  const updatedProduct = await productRepository.updateById(id, {
    status: "active",
    approvedAt: new Date(),
    moderatedBy: actor.id,
    rejectionReason: null,
    rejectedAt: null,
  });

  await recordAuditLog({
    actorId: actor.id,
    targetId: product._id,
    action: "product_approved",
    entityType: "product",
    beforeState,
    afterState: {
      status: updatedProduct.status,
      approvedAt: updatedProduct.approvedAt,
      moderatedBy: actor.id,
    },
    req,
  });

  return updatedProduct;
};

const rejectProduct = async ({
  id,
  reason,
  actor,
  req = null,
}) => {
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new AppError(
      "Rejection reason is required",
      400,
      "REJECTION_REASON_REQUIRED"
    );
  }

  const product = await productRepository.findById(id);

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  if (product.status !== "pending_approval") {
    throw new AppError(
      `Product cannot be rejected from status ${product.status}. Must be pending_approval.`,
      400,
      "INVALID_PRODUCT_STATUS"
    );
  }

  const beforeState = { status: product.status };

  const updatedProduct = await productRepository.updateById(id, {
    status: "rejected",
    rejectedAt: new Date(),
    moderatedBy: actor.id,
    rejectionReason: reason.trim(),
  });

  await recordAuditLog({
    actorId: actor.id,
    targetId: product._id,
    action: "product_rejected",
    entityType: "product",
    beforeState,
    afterState: {
      status: updatedProduct.status,
      rejectedAt: updatedProduct.rejectedAt,
      moderatedBy: actor.id,
      rejectionReason: reason.trim(),
    },
    req,
  });

  return updatedProduct;
};

module.exports = {
  createProduct,
  getProductById,
  getProductBySlug,
  listProducts,
  listMyProducts,
  updateProduct,
  deleteProduct,
  submitProductForApproval,
  approveProduct,
  rejectProduct,
  getVendorIdByUserId,
  resolveActorVendorId,
  ensureProductOwnership,
};