const Product = require("../models/Product");
// Ensure referenced Mongoose models are registered for safe population
require("../models/Vendor");
require("../models/Category");
require("../models/Brand");
require("../models/User");

const create = async (data, options = {}) => {
  if (options.session) {
    const docs = await Product.create(Array.isArray(data) ? data : [data], {
      session: options.session,
    });
    return Array.isArray(data) ? docs : docs[0];
  }
  return Product.create(data);
};

const findById = async (id, options = {}) => {
  const query = {
    _id: id,
  };

  if (!options.includeArchived && !options.includeDeleted) {
    query.deletedAt = null;
  }

  if (options.publicOnly) {
    query.status = "active";
  }

  let q = Product.findOne(query);
  if (options.populate !== false) {
    q = q
      .populate("categoryId", "name slug isActive")
      .populate("brandId", "name slug logo isActive")
      .populate(
        "vendorId",
        "businessName businessSlug storeName onboardingStatus status supportEmail phone businessAddress"
      )
      .populate("moderatedBy", "name email");
  }
  if (options.session) {
    q = q.session(options.session);
  }
  return q;
};

const findBySlug = async (slug, options = {}) => {
  const query = {
    slug,
  };

  if (!options.includeArchived && !options.includeDeleted) {
    query.deletedAt = null;
  }

  if (options.publicOnly) {
    query.status = "active";
  }

  let q = Product.findOne(query);
  if (options.populate !== false) {
    q = q
      .populate("categoryId", "name slug isActive")
      .populate("brandId", "name slug logo isActive")
      .populate(
        "vendorId",
        "businessName businessSlug storeName onboardingStatus status supportEmail phone businessAddress"
      )
      .populate("moderatedBy", "name email");
  }
  if (options.session) {
    q = q.session(options.session);
  }
  return q;
};

const findBySku = async (sku, options = {}) => {
  let q = Product.findOne({
    sku,
    deletedAt: null,
  });
  if (options.session) {
    q = q.session(options.session);
  }
  return q;
};

const updateById = async (id, data, options = {}) => {
  return Product.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    data,
    {
      new: true,
      runValidators: true,
      ...(options.session ? { session: options.session } : {}),
    }
  );
};

const softDeleteById = async (id, options = {}) => {
  return Product.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
      status: "archived",
    },
    {
      new: true,
      ...(options.session ? { session: options.session } : {}),
    }
  );
};

const list = async ({
  filter = {},
  skip = 0,
  limit = 20,
  sort = { createdAt: -1 },
}) => {
  const query = {
    deletedAt: null,
    ...filter,
  };

  const [items, total] = await Promise.all([
    Product.find(query)
      .populate("categoryId", "name slug")
      .populate("brandId", "name slug")
      .populate("vendorId", "businessName businessSlug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),

    Product.countDocuments(query),
  ]);

  return {
    items,
    total,
  };
};

module.exports = {
  create,
  findById,
  findBySlug,
  findBySku,
  updateById,
  softDeleteById,
  list,
};