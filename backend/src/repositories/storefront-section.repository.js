const StorefrontSection = require("../models/StorefrontSection");

const applyPopulateAndSession = (query, options = {}) => {
  if (!query) return query;
  if (typeof query.populate === "function") {
    query = query
      .populate("productIds")
      .populate("pinnedProductIds")
      .populate("excludedProductIds");
  }
  if (typeof query.session === "function") {
    return query.session(options.session || null);
  }
  return query;
};

const findById = (sectionId, options = {}) =>
  applyPopulateAndSession(StorefrontSection.findById(sectionId), options);

const findByKey = (key, options = {}) =>
  applyPopulateAndSession(StorefrontSection.findOne({ key }), options);

const getActiveQuery = () => {
  const now = new Date();
  return {
    isActive: true,
    publicationStatus: { $nin: ["draft", "archived"] },
    $and: [
      {
        $or: [
          { startsAt: null },
          { startsAt: { $exists: false } },
          { startsAt: { $lte: now } },
        ],
      },
      {
        $or: [
          { endsAt: null },
          { endsAt: { $exists: false } },
          { endsAt: { $gte: now } },
        ],
      },
    ],
  };
};

const findActiveByKey = (key, options = {}) =>
  applyPopulateAndSession(
    StorefrontSection.findOne({
      key,
      ...getActiveQuery(),
    }),
    options
  );

const findMany = (filter = {}, options = {}) => {
  let query = StorefrontSection.find(filter);
  if (query && typeof query.sort === "function") {
    query = query.sort({ displayOrder: 1, createdAt: 1 });
  }
  return applyPopulateAndSession(query, options);
};

const findActive = (options = {}) => {
  let query = StorefrontSection.find(getActiveQuery());
  if (query && typeof query.sort === "function") {
    query = query.sort({ displayOrder: 1, createdAt: 1 });
  }
  return applyPopulateAndSession(query, options);
};

const create = (data, options = {}) =>
  StorefrontSection.create([data], options).then(
    (docs) => docs[0]
  );

const updateById = (
  sectionId,
  update,
  options = {}
) => {
  let query = StorefrontSection.findByIdAndUpdate(
    sectionId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session || null,
    }
  );
  if (query && typeof query.populate === "function") {
    query = query
      .populate("productIds")
      .populate("pinnedProductIds")
      .populate("excludedProductIds");
  }
  return query;
};

const deleteById = (sectionId, options = {}) =>
  StorefrontSection.findByIdAndDelete(
    sectionId,
    {
      session: options.session || null,
    }
  );

const bulkReorder = async (sections = [], userId, options = {}) => {
  if (!sections.length) return [];

  const operations = sections.map((item) => {
    const updateDoc = {
      displayOrder: item.displayOrder,
      updatedBy: userId,
    };
    if (typeof item.isActive === "boolean") {
      updateDoc.isActive = item.isActive;
    }
    return {
      updateOne: {
        filter: { _id: item.id },
        update: { $set: updateDoc },
      },
    };
  });

  await StorefrontSection.bulkWrite(operations, {
    session: options.session || null,
  });

  return findMany({}, options);
};

module.exports = {
  findById,
  findByKey,
  findActiveByKey,
  findMany,
  findActive,
  create,
  updateById,
  deleteById,
  bulkReorder,
};