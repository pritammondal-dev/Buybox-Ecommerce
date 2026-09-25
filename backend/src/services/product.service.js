const mongoose = require("mongoose");
const productRepository = require("../repositories/product.repository");
const categoryRepository = require("../repositories/category.repository");
const brandRepository = require("../repositories/brand.repository");
const AppError = require("../errors/AppError");
const Vendor = require("../models/Vendor");
const { recordAuditLog } = require("./governance.service");
const { encodeSecureId, decodeSecureId } = require("../utils/secure-id.util");

const PRIVILEGED_ROLES = [
  "admin",
  "super_admin",
  "manager",
];

const getVendorIdByUserId = async (userId) => {
  const vendor = await Vendor.findOne({
    userId,
    deletedAt: null,
  });

  if (!vendor || !vendor.isActive) {
    throw new AppError(
      "Vendor profile not found",
      404,
      "VENDOR_NOT_FOUND"
    );
  }

  return vendor._id;
};

const resolveActorVendorId = async (actor) => {
  if (
    PRIVILEGED_ROLES.includes(actor.role) ||
    actor.role === "editor" ||
    actor.context === "administrator" ||
    actor.employee != null ||
    actor.roles?.some?.((r) => PRIVILEGED_ROLES.includes(r) || r === "editor")
  ) {
    return null;
  }

  if (actor.role !== "vendor" && !actor.roles?.includes?.("vendor")) {
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
  actor,
}) => {
  await ensureUniqueSku(data.sku);
  await ensureUniqueSlug(data.slug);

  await validateCategory(data.categoryId);
  await validateBrand(data.brandId);

  const isPrivileged = actor && (
    PRIVILEGED_ROLES.includes(actor.role) ||
    actor.role === "editor" ||
    actor.roles?.some?.((r) => PRIVILEGED_ROLES.includes(r) || r === "editor")
  );

  let vendorId;
  if (isPrivileged && data.vendorId) {
    const vendor = await Vendor.findById(data.vendorId);
    if (!vendor || !vendor.isActive) {
      throw new AppError("Vendor not found or inactive", 400, "INVALID_VENDOR");
    }
    vendorId = vendor._id;
  } else if (isPrivileged) {
    const defaultVendor = await Vendor.findOne({ isActive: true, deletedAt: null });
    if (!defaultVendor) {
      throw new AppError("No active vendor found to associate with product", 400, "VENDOR_REQUIRED");
    }
    vendorId = defaultVendor._id;
  } else {
    vendorId = await getVendorIdByUserId(userId);
  }

  const initialStatus = isPrivileged && data.status ? data.status : "draft";
  const isApproved = isPrivileged && initialStatus === "active";

  const safeData = {
    ...data,
    vendorId,
    status: initialStatus,
    submittedAt: isApproved ? new Date() : null,
    approvedAt: isApproved ? new Date() : null,
    rejectedAt: null,
    moderatedBy: isApproved ? (actor?._id || actor?.id) : null,
    rejectionReason: null,
  };

  return productRepository.create(safeData);
};

const getProductById = async (id) => {
  let resolvedId = null;
  const isHexOrSecure =
    typeof id === "string" &&
    (/^[a-fA-F0-9]{24}$/.test(id) || id.startsWith("prd_"));

  if (isHexOrSecure) {
    try {
      resolvedId = decodeSecureId(id, "product");
    } catch {
      resolvedId = null;
    }
  }

  let product = null;
  if (resolvedId) {
    product = await productRepository.findById(resolvedId, {
      publicOnly: true,
    });
  }

  // Fallback to lookup by slug if not found by ID or if id is a slug
  if (!product && typeof id === "string" && id.length > 0) {
    product = await productRepository.findBySlug(id, {
      publicOnly: true,
    });
  }

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  const raw = product.toObject ? product.toObject() : { ...product };
  return {
    ...raw,
    secureId: encodeSecureId("product", raw._id),
  };
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
  category,
  brandId,
  brand,
  vendorId,
  search,
  minPrice,
  maxPrice,
  rating,
  stockStatus,
  isFeatured,
  sort = "newest",
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

  const targetCategory = categoryId || category;
  if (targetCategory) {
    const rawCategories = Array.isArray(targetCategory)
      ? targetCategory
      : String(targetCategory).split(",").map((s) => s.trim()).filter(Boolean);

    const resolvedCategoryIds = [];

    for (const rawCat of rawCategories) {
      if (typeof rawCat === "string" && /^[a-fA-F0-9]{24}$/.test(rawCat)) {
        resolvedCategoryIds.push(new mongoose.Types.ObjectId(rawCat));
      } else if (rawCat instanceof mongoose.Types.ObjectId) {
        resolvedCategoryIds.push(rawCat);
      } else if (typeof rawCat === "string" && rawCat.length > 0) {
        // Resolve slug to category ID
        const categoryDoc = await categoryRepository.findBySlug(rawCat.toLowerCase());
        if (categoryDoc && categoryDoc._id) {
          resolvedCategoryIds.push(categoryDoc._id);
        } else {
          // If the requested category does not exist, return empty result gracefully without CastError
          return {
            items: [],
            meta: {
              page: safePage,
              limit: safeLimit,
              total: 0,
              totalPages: 0,
            },
          };
        }
      }
    }

    if (resolvedCategoryIds.length === 1) {
      filter.categoryId = resolvedCategoryIds[0];
    } else if (resolvedCategoryIds.length > 1) {
      filter.categoryId = { $in: resolvedCategoryIds };
    }
  }

  const targetBrand = brandId || brand;
  if (targetBrand) {
    const rawBrands = Array.isArray(targetBrand)
      ? targetBrand
      : String(targetBrand).split(",").map((s) => s.trim()).filter(Boolean);

    const resolvedBrandIds = [];

    for (const rawB of rawBrands) {
      if (typeof rawB === "string" && /^[a-fA-F0-9]{24}$/.test(rawB)) {
        resolvedBrandIds.push(new mongoose.Types.ObjectId(rawB));
      } else if (rawB instanceof mongoose.Types.ObjectId) {
        resolvedBrandIds.push(rawB);
      } else if (typeof rawB === "string" && rawB.length > 0) {
        let brandDoc = await brandRepository.findBySlug(rawB.toLowerCase());
        if (!brandDoc) {
          const Brand = require("../models/Brand");
          brandDoc = await Brand.findOne({
            name: new RegExp(`^${rawB.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
            deletedAt: null,
          });
        }
        if (brandDoc && brandDoc._id) {
          resolvedBrandIds.push(brandDoc._id);
        } else {
          return {
            items: [],
            meta: {
              page: safePage,
              limit: safeLimit,
              total: 0,
              totalPages: 0,
            },
          };
        }
      }
    }

    if (resolvedBrandIds.length === 1) {
      filter.brandId = resolvedBrandIds[0];
    } else if (resolvedBrandIds.length > 1) {
      filter.brandId = { $in: resolvedBrandIds };
    }
  }

  if (vendorId) {
    if (typeof vendorId === "string" && /^[a-fA-F0-9]{24}$/.test(vendorId)) {
      filter.vendorId = new mongoose.Types.ObjectId(vendorId);
    } else if (vendorId instanceof mongoose.Types.ObjectId) {
      filter.vendorId = vendorId;
    } else if (typeof vendorId === "string" && vendorId.length > 0) {
      try {
        const decoded = decodeSecureId(vendorId, "vendor", { strict: false });
        if (decoded && /^[a-fA-F0-9]{24}$/.test(decoded)) {
          filter.vendorId = new mongoose.Types.ObjectId(decoded);
        } else {
          return {
            items: [],
            meta: {
              page: safePage,
              limit: safeLimit,
              total: 0,
              totalPages: 0,
            },
          };
        }
      } catch {
        return {
          items: [],
          meta: {
            page: safePage,
            limit: safeLimit,
            total: 0,
            totalPages: 0,
          },
        };
      }
    }
  }

  if (search) {
    filter.$text = {
      $search: search,
    };
  }

  // Price range filters
  if (minPrice !== undefined && minPrice !== null && minPrice !== "") {
    const minVal = Number(minPrice);
    if (!Number.isNaN(minVal) && minVal >= 0) {
      filter.price = filter.price || {};
      filter.price.$gte = mongoose.Types.Decimal128.fromString(String(minVal));
    }
  }

  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== "") {
    const maxVal = Number(maxPrice);
    if (!Number.isNaN(maxVal) && maxVal >= 0) {
      filter.price = filter.price || {};
      filter.price.$lte = mongoose.Types.Decimal128.fromString(String(maxVal));
    }
  }

  // Customer rating filter (minimum average rating)
  if (rating !== undefined && rating !== null && rating !== "") {
    const ratingVal = Number(rating);
    if (!Number.isNaN(ratingVal) && ratingVal > 0) {
      filter.ratingAverage = { $gte: ratingVal };
    }
  }

  // Stock status filter
  if (stockStatus) {
    if (Array.isArray(stockStatus)) {
      filter.stockStatus = { $in: stockStatus };
    } else {
      filter.stockStatus = stockStatus;
    }
  }

  // Featured flag filter
  if (isFeatured === true || isFeatured === "true") {
    filter.isFeatured = true;
  }

  // Authoritative sorting
  let sortOption = { createdAt: -1 };
  if (sort === "price_asc") {
    sortOption = { price: 1, _id: 1 };
  } else if (sort === "price_desc") {
    sortOption = { price: -1, _id: 1 };
  } else if (sort === "rating_desc" || sort === "rating") {
    sortOption = { ratingAverage: -1, ratingCount: -1, _id: 1 };
  } else if (sort === "featured") {
    sortOption = { isFeatured: -1, createdAt: -1, _id: 1 };
  } else if (sort === "newest") {
    sortOption = { createdAt: -1, _id: 1 };
  }

  const skip =
    (safePage - 1) * safeLimit;

  const result =
    await productRepository.list({
      filter,
      skip,
      limit: safeLimit,
      sort: sortOption,
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
  const resolvedId = decodeSecureId(id, "product");
  const product =
    await productRepository.findById(resolvedId);

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
  const isPrivileged = actor && (
    PRIVILEGED_ROLES.includes(actor.role) ||
    actor.role === "editor" ||
    actor.context === "administrator" ||
    actor.employee != null ||
    actor.roles?.some?.((r) => PRIVILEGED_ROLES.includes(r) || r === "editor")
  );

  if (safeData.status && !isPrivileged) {
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

  if (isPrivileged && safeData.status === "active" && !product.approvedAt) {
    safeData.approvedAt = new Date();
    safeData.moderatedBy = actor.id || actor._id;
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
  const resolvedId = decodeSecureId(id, "product");
  const product =
    await productRepository.findById(resolvedId);

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

  return productRepository.softDeleteById(resolvedId);
};

const listMyProducts = async ({
  userId,
  vendorId: explicitVendorId,
  page = 1,
  limit = 20,
  status,
}) => {
  const vendorId = explicitVendorId || (await getVendorIdByUserId(userId));

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

  const itemsWithSecureId = (result.items || []).map((p) => {
    const raw = p.toObject ? p.toObject() : { ...p };
    return {
      ...raw,
      secureId: encodeSecureId("product", raw._id),
    };
  });

  return {
    items: itemsWithSecureId,
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
  const resolvedId = decodeSecureId(id, "product");
  const product = await productRepository.findById(resolvedId);

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

const duplicateProduct = async ({ id, actor, req = null }) => {
  const crypto = require("crypto");
  const Product = require("../models/Product");
  const ProductVariant = require("../models/ProductVariant");
  const product = await productRepository.findById(id);

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  await ensureProductOwnership(product, actor);

  const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  const newSku = `${product.sku}-COPY-${randomSuffix}`;
  const newSlug = `${product.slug}-copy-${randomSuffix.toLowerCase()}`;

  const duplicatedProduct = await Product.create({
    name: `${product.name} (Copy)`,
    slug: newSlug,
    sku: newSku,
    description: product.description,
    shortDescription: product.shortDescription,
    categoryId: product.categoryId,
    brandId: product.brandId,
    vendorId: product.vendorId,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    isTaxable: product.isTaxable,
    taxCategory: product.taxCategory,
    stockStatus: "out_of_stock",
    status: "draft",
    images: product.images,
    tags: product.tags,
    specifications: product.specifications,
    seo: product.seo,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    moderatedBy: null,
  });

  // Duplicate variants with unique SKUs and zero initial inventory
  const originalVariants = await ProductVariant.find({
    productId: product._id,
    deletedAt: null,
  }).lean();

  if (originalVariants.length > 0) {
    for (const v of originalVariants) {
      const vSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
      await ProductVariant.create({
        productId: duplicatedProduct._id,
        sku: `${v.sku}-COPY-${vSuffix}`,
        name: v.name,
        attributes: v.attributes,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        costPrice: v.costPrice,
        currency: v.currency,
        stockQuantity: 0,
        stockStatus: "out_of_stock",
        image: v.image,
        weight: v.weight,
      });
    }
  }

  await recordAuditLog({
    actorId: actor.id,
    targetId: duplicatedProduct._id,
    action: "product_duplicated",
    entityType: "product",
    afterState: {
      originalProductId: product._id,
      newProductId: duplicatedProduct._id,
      newSku,
      status: "draft",
    },
    req,
  });

  return duplicatedProduct;
};

module.exports = {
  createProduct,
  getProductById,
  getProductBySlug,
  listProducts,
  listMyProducts,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  submitProductForApproval,
  approveProduct,
  rejectProduct,
  getVendorIdByUserId,
  resolveActorVendorId,
  ensureProductOwnership,
};