const TaxRule = require("../models/TaxRule");

const create = async (data, options = {}) => {
  const [taxRule] = await TaxRule.create([data], options);
  return taxRule;
};

const findById = async (id, options = {}) => {
  return TaxRule.findOne({ _id: id, deletedAt: null }, null, options);
};

const findMany = async (filter = {}, options = {}) => {
  const query = { deletedAt: null, ...filter };
  return TaxRule.find(query, null, options).sort({
    country: 1,
    state: 1,
    priority: -1,
    createdAt: -1,
  });
};

const updateById = async (id, updateData, options = {}) => {
  return TaxRule.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: updateData },
    { new: true, runValidators: true, ...options }
  );
};

const softDeleteById = async (id, options = {}) => {
  return TaxRule.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { isActive: false, deletedAt: new Date() } },
    { new: true, ...options }
  );
};

/**
 * Find candidate active rules for a jurisdiction and tax category.
 * Returns state-specific candidates and country-wide fallback candidates.
 */
const findCandidateRules = async ({
  country,
  state = null,
  taxCategory,
  asOfDate = new Date(),
}, options = {}) => {
  const normalizedCountry = String(country || "").trim().toUpperCase();
  const normalizedState = state ? String(state).trim().toUpperCase() : null;

  const baseQuery = {
    country: normalizedCountry,
    taxCategory,
    isActive: true,
    deletedAt: null,
    $and: [
      {
        $or: [
          { startsAt: null },
          { startsAt: { $lte: asOfDate } },
        ],
      },
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $gte: asOfDate } },
        ],
      },
    ],
  };

  if (normalizedState) {
    baseQuery.state = { $in: [normalizedState, null, ""] };
  } else {
    baseQuery.state = { $in: [null, ""] };
  }

  return TaxRule.find(baseQuery, null, options).sort({
    priority: -1,
    updatedAt: -1,
    _id: -1,
  });
};

/**
 * Check for overlapping active rules with identical country, state, taxCategory, priority.
 */
const findConflictingRule = async ({
  country,
  state = null,
  taxCategory,
  priority = 0,
  startsAt = null,
  expiresAt = null,
  excludeId = null,
}, options = {}) => {
  const normalizedCountry = String(country || "").trim().toUpperCase();
  const normalizedState = state ? String(state).trim().toUpperCase() : null;

  const query = {
    country: normalizedCountry,
    state: normalizedState,
    taxCategory,
    priority,
    isActive: true,
    deletedAt: null,
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  // Check date range overlap
  const dateConditions = [];

  // If new rule has no startsAt, it effectively starts from -infinity.
  // If new rule has startsAt:
  if (startsAt) {
    dateConditions.push({
      $or: [
        { expiresAt: null },
        { expiresAt: { $gte: startsAt } },
      ],
    });
  }

  // If new rule has expiresAt:
  if (expiresAt) {
    dateConditions.push({
      $or: [
        { startsAt: null },
        { startsAt: { $lte: expiresAt } },
      ],
    });
  }

  if (dateConditions.length > 0) {
    query.$and = dateConditions;
  }

  return TaxRule.findOne(query, null, options);
};

module.exports = {
  create,
  findById,
  findMany,
  updateById,
  softDeleteById,
  findCandidateRules,
  findConflictingRule,
};
