const mongoose = require("mongoose");

const storefrontSectionRepository = require("../repositories/storefront-section.repository");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const AppError = require("../errors/AppError");

const SYSTEM_SECTION_KEYS = [
  "featured_products",
  "new_arrivals",
  "best_sellers",
  "flash_deal",
  "flash_sale",
];

const SYSTEM_SECTION_DEFINITIONS = [
  {
    key: "featured_products",
    title: "Featured Products",
    subtitle: "Handpicked for you, only the best.",
    type: "featured_products",
    selectionMode: "manual",
    limit: 12,
    displayOrder: 1,
    isActive: true,
    isSystem: true,
  },
  {
    key: "new_arrivals",
    title: "New Arrivals",
    subtitle: "Latest products, just for you.",
    type: "new_arrivals",
    selectionMode: "automatic",
    limit: 12,
    displayOrder: 2,
    isActive: true,
    isSystem: true,
  },
  {
    key: "best_sellers",
    title: "Best Sellers",
    subtitle: "Most loved products, top quality.",
    type: "best_sellers",
    selectionMode: "automatic",
    rankingMetric: "units_sold",
    lookbackDays: 30,
    limit: 12,
    displayOrder: 3,
    isActive: true,
    isSystem: true,
  },
  {
    key: "flash_deal",
    title: "Today's Hot Deals",
    subtitle: "Limited time special discounts.",
    type: "flash_deal",
    selectionMode: "manual",
    limit: 8,
    displayOrder: 4,
    isActive: true,
    isSystem: true,
  },
  {
    key: "flash_sale",
    title: "Flash Sale",
    subtitle: "Huge discounts on top tech gadgets.",
    type: "flash_sale",
    selectionMode: "manual",
    limit: 8,
    displayOrder: 5,
    isActive: true,
    isSystem: true,
  },
];

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase().replace(/\s+/g, "_")}`
    );
  }
};

const validateProductIds = (productIds = []) => {
  for (const productId of productIds) {
    validateObjectId(productId, "product ID");
  }
};

const validateCategoryIds = (categoryIds = []) => {
  for (const categoryId of categoryIds) {
    validateObjectId(categoryId, "category ID");
  }
};

const validateBrandIds = (brandIds = []) => {
  for (const brandId of brandIds) {
    validateObjectId(brandId, "brand ID");
  }
};

const validateSectionReferences = (data) => {
  if (data.collectionId) {
    validateObjectId(data.collectionId, "collection ID");
  }

  if (data.categoryId) {
    validateObjectId(data.categoryId, "category ID");
  }

  if (data.brandId) {
    validateObjectId(data.brandId, "brand ID");
  }

  if (data.categoryIds?.length) {
    validateCategoryIds(data.categoryIds);
  }

  validateProductIds(data.productIds || []);
  validateProductIds(data.pinnedProductIds || []);
  validateProductIds(data.excludedProductIds || []);

  if (data.automaticRules) {
    if (data.automaticRules.categoryIds?.length) {
      validateCategoryIds(data.automaticRules.categoryIds);
    }
    if (data.automaticRules.excludedCategoryIds?.length) {
      validateCategoryIds(data.automaticRules.excludedCategoryIds);
    }
    if (data.automaticRules.brandIds?.length) {
      validateBrandIds(data.automaticRules.brandIds);
    }
    if (data.automaticRules.excludedBrandIds?.length) {
      validateBrandIds(data.automaticRules.excludedBrandIds);
    }
  }

  if (Array.isArray(data.groups)) {
    for (const group of data.groups) {
      if (group.categoryId) validateObjectId(group.categoryId, "group category ID");
      if (group.subcategoryId) validateObjectId(group.subcategoryId, "group subcategory ID");
      if (group.brandId) validateObjectId(group.brandId, "group brand ID");
      validateProductIds(group.productIds || []);
      validateProductIds(group.pinnedProductIds || []);
      validateProductIds(group.excludedProductIds || []);
      if (group.automaticRules) {
        if (group.automaticRules.categoryIds?.length) {
          validateCategoryIds(group.automaticRules.categoryIds);
        }
        if (group.automaticRules.excludedCategoryIds?.length) {
          validateCategoryIds(group.automaticRules.excludedCategoryIds);
        }
        if (group.automaticRules.brandIds?.length) {
          validateBrandIds(group.automaticRules.brandIds);
        }
        if (group.automaticRules.excludedBrandIds?.length) {
          validateBrandIds(group.automaticRules.excludedBrandIds);
        }
      }
    }
  }
};

/**
 * Aggregates qualifying orders to rank Best Sellers
 */
const resolveBestSellers = async ({
  lookbackDays = 30,
  rankingMetric = "units_sold",
  limit = 12,
  excludedIds = [],
}) => {
  const safeDays = Math.max(1, Math.min(lookbackDays, 365));
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - safeDays);

  const qualifyingStatuses = [
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "completed",
  ];

  const matchFilter = {
    status: { $in: qualifyingStatuses },
    paymentStatus: { $nin: ["failed", "refunded"] },
    cancellationStatus: "none",
    createdAt: { $gte: sinceDate },
  };

  const aggregated = await Order.aggregate([
    { $match: matchFilter },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        totalUnitsSold: { $sum: "$items.quantity" },
        totalRevenue: {
          $sum: {
            $multiply: [
              { $toDouble: "$items.unitPrice" },
              "$items.quantity",
            ],
          },
        },
      },
    },
    {
      $sort:
        rankingMetric === "revenue"
          ? { totalRevenue: -1, totalUnitsSold: -1 }
          : { totalUnitsSold: -1, totalRevenue: -1 },
    },
    { $limit: limit * 3 },
  ]);

  const excludedSet = new Set((excludedIds || []).map((id) => id.toString()));
  const orderProductIds = aggregated
    .map((a) => a._id)
    .filter((id) => id && !excludedSet.has(id.toString()));

  let products = [];
  if (orderProductIds.length > 0) {
    const activeFound = await Product.find({
      _id: { $in: orderProductIds },
      status: "active",
    }).lean();

    const prodMap = new Map(activeFound.map((p) => [p._id.toString(), p]));

    for (const id of orderProductIds) {
      const prod = prodMap.get(id.toString());
      if (prod) {
        products.push(prod);
        if (products.length >= limit) break;
      }
    }
  }

  return products;
};

/**
 * Core product resolution engine supporting Manual, Automatic, and Hybrid modes
 */
const resolveProductCollection = async (config) => {
  const limit = Math.max(1, Math.min(config.limit || 12, 100));
  const mode = config.selectionMode || "manual";
  const excludedIds = (config.excludedProductIds || [])
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => id.toString());
  const excludedSet = new Set(excludedIds);

  // 1. MANUAL SELECTION
  if (mode === "manual") {
    const rawList = config.productIds || [];
    if (rawList[0] && typeof rawList[0] === "object" && rawList[0].name) {
      return rawList
        .filter((p) => (p.status === "active" || !p.status) && !excludedSet.has((p._id || p.id).toString()))
        .slice(0, limit);
    }

    const validIds = rawList
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => id.toString())
      .filter((id) => !excludedSet.has(id));

    if (validIds.length === 0) return [];

    const activeProducts = await Product.find({
      _id: { $in: validIds },
      status: "active",
    }).lean();

    const map = new Map(activeProducts.map((p) => [p._id.toString(), p]));
    const ordered = [];
    for (const id of validIds) {
      const p = map.get(id);
      if (p) {
        ordered.push(p);
        if (ordered.length >= limit) break;
      }
    }
    return ordered;
  }

  // 2. PINNED PRODUCTS (Used in HYBRID SELECTION)
  let pinnedProducts = [];
  if (mode === "hybrid" && Array.isArray(config.pinnedProductIds) && config.pinnedProductIds.length > 0) {
    const pinnedValidIds = config.pinnedProductIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => id.toString())
      .filter((id) => !excludedSet.has(id));

    if (pinnedValidIds.length > 0) {
      const foundPinned = await Product.find({
        _id: { $in: pinnedValidIds },
        status: "active",
      }).lean();

      const pinnedMap = new Map(foundPinned.map((p) => [p._id.toString(), p]));
      for (const id of pinnedValidIds) {
        const prod = pinnedMap.get(id);
        if (prod) {
          pinnedProducts.push(prod);
          if (pinnedProducts.length >= limit) break;
        }
      }
    }

    if (pinnedProducts.length >= limit) {
      return pinnedProducts;
    }
  }

  // 3. AUTOMATIC SELECTION (Standalone or filling hybrid slots)
  const slotsNeeded = limit - pinnedProducts.length;
  const currentExcluded = new Set([...excludedSet, ...pinnedProducts.map((p) => p._id.toString())]);

  const rules = config.automaticRules || {};
  const isBestSellers =
    config.type === "best_sellers" ||
    rules.sortBy === "sales" ||
    config.rankingMetric === "units_sold" ||
    config.rankingMetric === "revenue";

  let autoProducts = [];

  if (isBestSellers) {
    autoProducts = await resolveBestSellers({
      lookbackDays: config.lookbackDays || rules.lookbackDays || 30,
      rankingMetric: config.rankingMetric || "units_sold",
      limit: slotsNeeded,
      excludedIds: Array.from(currentExcluded),
    });
  } else {
    // Build catalog query
    const filter = {
      status: "active",
    };

    if (currentExcluded.size > 0) {
      filter._id = {
        $nin: Array.from(currentExcluded).map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    // Category filtering
    const catInclusions = [];
    if (config.categoryId && mongoose.isValidObjectId(config.categoryId)) {
      catInclusions.push(new mongoose.Types.ObjectId(config.categoryId));
    }
    if (rules.categoryIds?.length) {
      for (const cId of rules.categoryIds) {
        if (mongoose.isValidObjectId(cId)) catInclusions.push(new mongoose.Types.ObjectId(cId));
      }
    }
    if (catInclusions.length === 1) {
      filter.categoryId = catInclusions[0];
    } else if (catInclusions.length > 1) {
      filter.categoryId = { $in: catInclusions };
    }

    if (rules.excludedCategoryIds?.length) {
      const catExclusions = rules.excludedCategoryIds
        .filter((c) => mongoose.isValidObjectId(c))
        .map((c) => new mongoose.Types.ObjectId(c));
      if (catExclusions.length > 0) {
        filter.categoryId = filter.categoryId
          ? { ...filter.categoryId, $nin: catExclusions }
          : { $nin: catExclusions };
      }
    }

    // Brand filtering
    const brandInclusions = [];
    if (config.brandId && mongoose.isValidObjectId(config.brandId)) {
      brandInclusions.push(new mongoose.Types.ObjectId(config.brandId));
    }
    if (rules.brandIds?.length) {
      for (const bId of rules.brandIds) {
        if (mongoose.isValidObjectId(bId)) brandInclusions.push(new mongoose.Types.ObjectId(bId));
      }
    }
    if (brandInclusions.length === 1) {
      filter.brandId = brandInclusions[0];
    } else if (brandInclusions.length > 1) {
      filter.brandId = { $in: brandInclusions };
    }

    if (rules.excludedBrandIds?.length) {
      const brandExclusions = rules.excludedBrandIds
        .filter((b) => mongoose.isValidObjectId(b))
        .map((b) => new mongoose.Types.ObjectId(b));
      if (brandExclusions.length > 0) {
        filter.brandId = filter.brandId
          ? { ...filter.brandId, $nin: brandExclusions }
          : { $nin: brandExclusions };
      }
    }

    // Price filtering
    if (rules.minPrice != null && rules.minPrice >= 0) {
      filter.price = filter.price || {};
      filter.price.$gte = mongoose.Types.Decimal128.fromString(String(rules.minPrice));
    }
    if (rules.maxPrice != null && rules.maxPrice >= 0) {
      filter.price = filter.price || {};
      filter.price.$lte = mongoose.Types.Decimal128.fromString(String(rules.maxPrice));
    }

    // Stock availability
    if (rules.inStockOnly) {
      filter.stockStatus = "in_stock";
    }

    // Discount filtering
    if (rules.hasDiscountOnly) {
      filter.compareAtPrice = { $ne: null };
    }

    // Sort order
    let sort = { createdAt: -1, _id: -1 };
    const sortBy = rules.sortBy || config.sortBy || "newest";
    if (sortBy === "price_asc") {
      sort = { price: 1, _id: 1 };
    } else if (sortBy === "price_desc") {
      sort = { price: -1, _id: 1 };
    } else if (sortBy === "rating_desc") {
      sort = { ratingAverage: -1, ratingCount: -1, _id: 1 };
    } else if (sortBy === "discount_desc") {
      sort = { compareAtPrice: -1, price: 1, _id: 1 };
    } else if (sortBy === "newest" || config.type === "new_arrivals") {
      sort = { createdAt: -1, _id: -1 };
    }

    // Fetch candidate products
    const fetchMultiplier = (rules.maxPerBrand || rules.maxPerCategory) ? 3 : 1;
    const candidates = await Product.find(filter)
      .sort(sort)
      .limit(slotsNeeded * fetchMultiplier)
      .lean();

    // Apply maxPerBrand and maxPerCategory limits
    const brandCounts = new Map();
    const categoryCounts = new Map();

    for (const prod of candidates) {
      const bId = prod.brandId ? prod.brandId.toString() : null;
      const cId = prod.categoryId ? prod.categoryId.toString() : null;

      if (rules.maxPerBrand && bId) {
        const count = brandCounts.get(bId) || 0;
        if (count >= rules.maxPerBrand) continue;
      }

      if (rules.maxPerCategory && cId) {
        const count = categoryCounts.get(cId) || 0;
        if (count >= rules.maxPerCategory) continue;
      }

      if (bId) brandCounts.set(bId, (brandCounts.get(bId) || 0) + 1);
      if (cId) categoryCounts.set(cId, (categoryCounts.get(cId) || 0) + 1);

      autoProducts.push(prod);
      if (autoProducts.length >= slotsNeeded) break;
    }
  }

  // Combine pinned + auto
  let result = [...pinnedProducts, ...autoProducts];

  // 4. FALLBACK if total products < limit
  const fallbackStrategy =
    rules.fallbackStrategy ||
    config.fallbackStrategy ||
    (config.type === "best_sellers" ? "featured" : "none");
  if (result.length < limit && fallbackStrategy && fallbackStrategy !== "none") {
    const existingIds = new Set(result.map((p) => p._id.toString()));
    const allExclusions = new Set([...existingIds, ...excludedSet]);

    const fallbackFilter = {
      status: "active",
      _id: { $nin: Array.from(allExclusions).map((id) => new mongoose.Types.ObjectId(id)) },
    };

    const needed = limit - result.length;
    const fallbackProducts = await Product.find(fallbackFilter)
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(needed)
      .lean();

    result = result.concat(fallbackProducts);
  }

  return result;
};

/**
 * Dynamically resolves products for storefront section and its groups
 */
const resolveSectionProducts = async (section) => {
  // 1. Resolve multi-group category or brand showcase if present
  if (Array.isArray(section.groups) && section.groups.length > 0) {
    const resolvedGroups = await Promise.all(
      section.groups.map(async (grp) => {
        if (grp.isActive === false) return grp;
        const g = grp.toObject ? grp.toObject() : { ...grp };
        g.resolvedProducts = await resolveProductCollection({
          selectionMode: g.selectionMode || "automatic",
          limit: g.limit || 8,
          productIds: g.productIds,
          pinnedProductIds: g.pinnedProductIds,
          excludedProductIds: g.excludedProductIds || section.excludedProductIds,
          categoryId: g.categoryId,
          brandId: g.brandId,
          automaticRules: g.automaticRules || section.automaticRules,
          sortBy: g.sortBy,
          type: g.type,
        });
        return g;
      })
    );
    section.groups = resolvedGroups;
  }

  // 2. Resolve section-level products
  return resolveProductCollection({
    selectionMode: section.selectionMode || "manual",
    limit: section.limit || 12,
    productIds: section.productIds,
    pinnedProductIds: section.pinnedProductIds,
    excludedProductIds: section.excludedProductIds,
    categoryId: section.categoryId,
    brandId: section.brandId,
    automaticRules: section.automaticRules,
    rankingMetric: section.rankingMetric,
    lookbackDays: section.lookbackDays,
    sortBy: section.automaticRules?.sortBy,
    type: section.type,
    fallbackStrategy: section.automaticRules?.fallbackStrategy,
  });
};

const getSectionById = async (sectionId) => {
  validateObjectId(sectionId, "section ID");

  const section = await storefrontSectionRepository.findById(sectionId);

  if (!section) {
    throw new AppError(
      "Storefront section not found",
      404,
      "STOREFRONT_SECTION_NOT_FOUND"
    );
  }

  return section;
};

const getSectionByKey = async (key) => {
  const section = await storefrontSectionRepository.findByKey(key);

  if (!section) {
    throw new AppError(
      "Storefront section not found",
      404,
      "STOREFRONT_SECTION_NOT_FOUND"
    );
  }

  return section;
};

const getActiveSection = async (key) => {
  const section = await storefrontSectionRepository.findActiveByKey(key);

  if (!section) {
    throw new AppError(
      "Active storefront section not found",
      404,
      "ACTIVE_STOREFRONT_SECTION_NOT_FOUND"
    );
  }

  const plainSection = section.toObject ? section.toObject() : { ...section };
  plainSection.productIds = await resolveSectionProducts(plainSection);

  return plainSection;
};

const getActiveSections = async () => {
  let sections = await storefrontSectionRepository.findActive();

  // If no sections exist in the database, automatically seed defaults
  if (!sections || sections.length === 0) {
    await initializeDefaultSections();
    sections = await storefrontSectionRepository.findActive();
  }

  // Resolve dynamic products for each active section
  const resolvedSections = await Promise.all(
    sections.map(async (sec) => {
      const plain = sec.toObject ? sec.toObject() : { ...sec };
      plain.productIds = await resolveSectionProducts(plain);
      return plain;
    })
  );

  return resolvedSections;
};

const listSections = async (filter = {}) => {
  let sections = await storefrontSectionRepository.findMany(filter);

  // If no sections exist at all, auto seed system sections
  if (!sections || sections.length === 0) {
    await initializeDefaultSections();
    sections = await storefrontSectionRepository.findMany(filter);
  }

  return sections;
};

const createSection = async (data, userId) => {
  validateObjectId(userId, "user ID");
  validateSectionReferences(data);

  const existing = await storefrontSectionRepository.findByKey(data.key);

  if (existing) {
    throw new AppError(
      "A storefront section with this key already exists",
      409,
      "STOREFRONT_SECTION_EXISTS"
    );
  }

  if (data.type === "collection" && !data.collectionId) {
    throw new AppError(
      "collectionId is required for collection sections",
      400,
      "COLLECTION_ID_REQUIRED"
    );
  }

  if (data.type === "category" && !data.categoryId) {
    throw new AppError(
      "categoryId is required for category sections",
      400,
      "CATEGORY_ID_REQUIRED"
    );
  }

  if (
    data.type === "category_showcase" &&
    (!data.categoryIds || data.categoryIds.length === 0) &&
    (!data.groups || data.groups.length === 0)
  ) {
    throw new AppError(
      "categoryIds or category groups are required for category showcase sections",
      400,
      "CATEGORY_IDS_REQUIRED"
    );
  }

  if (
    data.type === "brand_showcase" &&
    !data.brandId &&
    (!data.groups || data.groups.length === 0) &&
    (!data.automaticRules?.brandIds || data.automaticRules.brandIds.length === 0)
  ) {
    throw new AppError(
      "brandId, brand groups, or automatic brand rules are required for brand showcase sections",
      400,
      "BRAND_SELECTION_REQUIRED"
    );
  }

  // Only require manual productIds if mode is explicit manual, no groups defined, and type is products/featured_products
  if (
    ["products", "featured_products"].includes(data.type) &&
    data.selectionMode === "manual" &&
    (!data.groups || data.groups.length === 0) &&
    !data.productIds?.length
  ) {
    throw new AppError(
      "productIds are required for manual product sections",
      400,
      "PRODUCT_IDS_REQUIRED"
    );
  }

  return storefrontSectionRepository.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
};

const updateSection = async (sectionId, data, userId) => {
  validateObjectId(userId, "user ID");

  const section = await getSectionById(sectionId);

  validateSectionReferences(data);

  // Protect system section keys
  if (section.isSystem || SYSTEM_SECTION_KEYS.includes(section.key)) {
    if (data.key && data.key !== section.key) {
      throw new AppError(
        "System section key cannot be modified",
        400,
        "SYSTEM_SECTION_KEY_IMMUTABLE"
      );
    }
  } else if (data.key && data.key !== section.key) {
    const existing = await storefrontSectionRepository.findByKey(data.key);

    if (
      existing &&
      existing._id.toString() !== section._id.toString()
    ) {
      throw new AppError(
        "A storefront section with this key already exists",
        409,
        "STOREFRONT_SECTION_EXISTS"
      );
    }
  }

  const type =
    data.type !== undefined ? data.type : section.type;

  const collectionId =
    data.collectionId !== undefined
      ? data.collectionId
      : section.collectionId;

  const categoryId =
    data.categoryId !== undefined
      ? data.categoryId
      : section.categoryId;

  const categoryIds =
    data.categoryIds !== undefined
      ? data.categoryIds
      : section.categoryIds;

  const productIds =
    data.productIds !== undefined
      ? data.productIds
      : section.productIds;

  const selectionMode =
    data.selectionMode !== undefined
      ? data.selectionMode
      : section.selectionMode;

  const groups =
    data.groups !== undefined
      ? data.groups
      : section.groups;

  if (type === "collection" && !collectionId) {
    throw new AppError(
      "collectionId is required for collection sections",
      400,
      "COLLECTION_ID_REQUIRED"
    );
  }

  if (type === "category" && !categoryId) {
    throw new AppError(
      "categoryId is required for category sections",
      400,
      "CATEGORY_ID_REQUIRED"
    );
  }

  if (
    type === "category_showcase" &&
    (!categoryIds || categoryIds.length === 0) &&
    (!groups || groups.length === 0)
  ) {
    throw new AppError(
      "categoryIds or category groups are required for category showcase sections",
      400,
      "CATEGORY_IDS_REQUIRED"
    );
  }

  if (
    ["products", "featured_products"].includes(type) &&
    selectionMode === "manual" &&
    (!groups || groups.length === 0) &&
    (!productIds || productIds.length === 0)
  ) {
    throw new AppError(
      "productIds are required for manual product sections",
      400,
      "PRODUCT_IDS_REQUIRED"
    );
  }

  return storefrontSectionRepository.updateById(sectionId, {
    ...data,
    updatedBy: userId,
  });
};

const deleteSection = async (sectionId) => {
  const section = await getSectionById(sectionId);

  if (section.isSystem || SYSTEM_SECTION_KEYS.includes(section.key)) {
    throw new AppError(
      "System sections cannot be deleted. You can disable them or adjust their settings instead.",
      400,
      "SYSTEM_SECTION_CANNOT_BE_DELETED"
    );
  }

  await storefrontSectionRepository.deleteById(sectionId);

  return {
    id: sectionId,
  };
};

const reorderSections = async (sections, userId) => {
  validateObjectId(userId, "user ID");
  return storefrontSectionRepository.bulkReorder(sections, userId);
};

const initializeDefaultSections = async (explicitUserId = null) => {
  let userId = explicitUserId;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    const adminUser = await User.findOne({
      role: { $in: ["SUPERADMIN", "super_admin", "ADMIN", "admin"] },
    }).select("_id");
    userId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();
  }

  for (const def of SYSTEM_SECTION_DEFINITIONS) {
    const existing = await storefrontSectionRepository.findByKey(def.key);
    if (!existing) {
      await storefrontSectionRepository.create({
        ...def,
        createdBy: userId,
        updatedBy: userId,
      });
    }
  }

  return storefrontSectionRepository.findMany();
};

/**
 * Server-side paginated product discovery for View More listings
 */
const getSectionProductsPaginated = async ({ keyOrId, query = {}, actor = null }) => {
  const isPrivileged =
    actor &&
    (["admin", "super_admin", "manager"].includes(actor.role) ||
      actor.context === "administrator" ||
      actor.employee != null);

  let section = null;
  if (mongoose.isValidObjectId(keyOrId)) {
    section = await storefrontSectionRepository.findById(keyOrId);
  }
  if (!section) {
    section = await storefrontSectionRepository.findByKey(keyOrId);
  }

  if (!section) {
    throw new AppError("Storefront section not found", 404, "STOREFRONT_SECTION_NOT_FOUND");
  }

  if (!isPrivileged && (section.isActive === false || section.publicationStatus === "draft" || section.publicationStatus === "archived")) {
    throw new AppError("Storefront section not found", 404, "STOREFRONT_SECTION_NOT_FOUND");
  }

  const sObj = section.toObject ? section.toObject() : { ...section };

  // Check if a specific group within the section was requested
  let targetGroup = null;
  if (query.groupId && Array.isArray(sObj.groups)) {
    targetGroup = sObj.groups.find(
      (g) => g.id === query.groupId || (g._id && g._id.toString() === query.groupId)
    );
  }

  const activeScope = targetGroup || sObj;
  const safePage = Math.max(1, Number(query.page) || 1);
  const safeLimit = Math.min(
    100,
    Math.max(1, Number(query.limit) || activeScope.listingLimit || sObj.listingLimit || 24)
  );
  const skip = (safePage - 1) * safeLimit;

  // Build Query Filter
  const filter = {
    status: "active",
  };

  // Exclusions from section & group
  const excludedIds = [
    ...(sObj.excludedProductIds || []),
    ...(targetGroup?.excludedProductIds || []),
  ]
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (excludedIds.length > 0) {
    filter._id = { $nin: excludedIds };
  }

  // Category Scope
  const categoryParam = query.category || targetGroup?.categoryId || sObj.categoryId;
  if (categoryParam) {
    if (mongoose.isValidObjectId(categoryParam)) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryParam);
    } else {
      const catDoc = await Category.findOne({ slug: categoryParam.toLowerCase() });
      if (catDoc) filter.categoryId = catDoc._id;
    }
  } else if (activeScope.automaticRules?.categoryIds?.length) {
    const validCatIds = activeScope.automaticRules.categoryIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (validCatIds.length > 0) {
      filter.categoryId = { $in: validCatIds };
    }
  }

  // Brand Scope
  const brandParam = query.brand || targetGroup?.brandId || sObj.brandId;
  if (brandParam) {
    if (mongoose.isValidObjectId(brandParam)) {
      filter.brandId = new mongoose.Types.ObjectId(brandParam);
    } else {
      const brandDoc = await Brand.findOne({ slug: brandParam.toLowerCase() });
      if (brandDoc) filter.brandId = brandDoc._id;
    }
  } else if (activeScope.automaticRules?.brandIds?.length) {
    const validBrandIds = activeScope.automaticRules.brandIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (validBrandIds.length > 0) {
      filter.brandId = { $in: validBrandIds };
    }
  }

  // Price range filters
  if (query.minPrice != null && query.minPrice !== "") {
    const minVal = Number(query.minPrice);
    if (!isNaN(minVal) && minVal >= 0) {
      filter.price = filter.price || {};
      filter.price.$gte = mongoose.Types.Decimal128.fromString(String(minVal));
    }
  }
  if (query.maxPrice != null && query.maxPrice !== "") {
    const maxVal = Number(query.maxPrice);
    if (!isNaN(maxVal) && maxVal >= 0) {
      filter.price = filter.price || {};
      filter.price.$lte = mongoose.Types.Decimal128.fromString(String(maxVal));
    }
  }

  // In-stock only
  if (query.inStockOnly || activeScope.automaticRules?.inStockOnly) {
    filter.stockStatus = "in_stock";
  }

  // Manual Section Scope: if selectionMode is manual, paginate the manual collection
  const mode = activeScope.selectionMode || "manual";
  let items = [];
  let total = 0;

  if (mode === "manual" && Array.isArray(activeScope.productIds) && activeScope.productIds.length > 0) {
    const manualIds = activeScope.productIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => id.toString())
      .filter((id) => !excludedIds.some((ex) => ex.toString() === id));

    const candidateFilter = {
      _id: { $in: manualIds.map((id) => new mongoose.Types.ObjectId(id)) },
      ...filter,
    };

    total = await Product.countDocuments(candidateFilter);
    const paginatedIds = manualIds.slice(skip, skip + safeLimit);

    if (paginatedIds.length > 0) {
      const activeProducts = await Product.find({
        _id: { $in: paginatedIds.map((id) => new mongoose.Types.ObjectId(id)) },
        ...filter,
      }).lean();

      const prodMap = new Map(activeProducts.map((p) => [p._id.toString(), p]));
      for (const id of paginatedIds) {
        const p = prodMap.get(id);
        if (p) items.push(p);
      }
    }
  } else {
    // Sorting
    let sort = { createdAt: -1, _id: -1 };
    const sortBy = query.sortBy || activeScope.automaticRules?.sortBy || activeScope.sortBy || "newest";
    if (sortBy === "price_asc") sort = { price: 1, _id: 1 };
    else if (sortBy === "price_desc") sort = { price: -1, _id: 1 };
    else if (sortBy === "rating_desc") sort = { ratingAverage: -1, ratingCount: -1, _id: 1 };
    else if (sortBy === "discount_desc") sort = { compareAtPrice: -1, price: 1, _id: 1 };
    else if (sortBy === "newest") sort = { createdAt: -1, _id: -1 };

    [items, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(safeLimit).lean(),
      Product.countDocuments(filter),
    ]);
  }

  // Available filters (distinct categories & brands in scope)
  let availableCategories = [];
  let availableBrands = [];
  try {
    const [categoryIds, brandIds] = await Promise.all([
      Product.distinct("categoryId", { status: "active" }),
      Product.distinct("brandId", { status: "active" }),
    ]);

    [availableCategories, availableBrands] = await Promise.all([
      Category.find({ _id: { $in: categoryIds }, isActive: true })
        .select("_id name slug")
        .sort({ name: 1 })
        .lean(),
      Brand.find({ _id: { $in: brandIds }, isActive: true })
        .select("_id name slug logo")
        .sort({ name: 1 })
        .lean(),
    ]);
  } catch {
    availableCategories = [];
    availableBrands = [];
  }

  return {
    section: {
      id: sObj._id,
      key: sObj.key,
      title: sObj.title,
      subtitle: sObj.subtitle,
      type: sObj.type,
      theme: sObj.theme,
      groups: Array.isArray(sObj.groups)
        ? sObj.groups
            .filter((g) => g.isActive !== false)
            .map((g) => ({
              id: g.id || g._id?.toString(),
              title: g.title,
              subtitle: g.subtitle,
              type: g.type,
              theme: g.theme,
            }))
        : [],
      viewMoreTitle: sObj.viewMoreTitle || "View All",
      viewMoreUrl: sObj.viewMoreUrl,
    },
    group: targetGroup
      ? {
          id: targetGroup.id,
          title: targetGroup.title,
          subtitle: targetGroup.subtitle,
          type: targetGroup.type,
          theme: targetGroup.theme,
        }
      : null,
    products: items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
      hasNextPage: safePage < Math.ceil(total / safeLimit),
      hasPrevPage: safePage > 1,
    },
    availableFilters: {
      categories: availableCategories,
      brands: availableBrands,
    },
  };
};

module.exports = {
  getSectionById,
  getSectionByKey,
  getActiveSection,
  getActiveSections,
  listSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  initializeDefaultSections,
  resolveSectionProducts,
  resolveProductCollection,
  getSectionProductsPaginated,
  SYSTEM_SECTION_KEYS,
};