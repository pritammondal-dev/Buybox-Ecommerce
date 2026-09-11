const mongoose = require("mongoose");
const taxRepository = require("../repositories/tax.repository");
const AppError = require("../errors/AppError");
const {
  ALLOWED_TAX_CATEGORIES,
  DEFAULT_TAX_CATEGORY,
  TAX_CATEGORIES,
  TAX_PRICING_MODES,
  ALLOWED_TAX_PRICING_MODES,
  DEFAULT_TAX_PRICING_MODE,
} = require("../constants/tax.constants");

const MINOR_UNIT_SCALE = 100;

const decimalToMinorUnits = (value) => {
  const decimalString = value?.toString?.() ?? String(value ?? "0");
  const normalizedValue = decimalString.trim();

  if (!/^-?\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new AppError(
      "Invalid monetary value",
      500,
      "INVALID_MONEY_VALUE"
    );
  }

  const sign = normalizedValue.startsWith("-") ? -1 : 1;
  const unsignedValue = normalizedValue.replace("-", "");
  const [wholePart = "0", fractionalPart = ""] = unsignedValue.split(".");
  const normalizedFraction = fractionalPart.padEnd(2, "0").slice(0, 2);

  const minorUnits =
    Number(wholePart) * MINOR_UNIT_SCALE + Number(normalizedFraction);

  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Monetary value is too large",
      500,
      "MONEY_VALUE_TOO_LARGE"
    );
  }

  return sign * minorUnits;
};

const minorUnitsToDecimalString = (minorUnits) => {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Invalid minor unit amount",
      500,
      "INVALID_MINOR_UNIT_AMOUNT"
    );
  }

  const sign = minorUnits < 0 ? "-" : "";
  const absoluteValue = Math.abs(minorUnits);
  const wholePart = Math.floor(absoluteValue / MINOR_UNIT_SCALE);
  const fractionalPart = String(
    absoluteValue % MINOR_UNIT_SCALE
  ).padStart(2, "0");

  return `${sign}${wholePart}.${fractionalPart}`;
};

/**
 * Proportional discount distribution across eligible items
 * using the Largest-Remainder (Hare-Niemeyer) method.
 * Guarantees exact conservation of the total discount.
 * Keyed by item.originalIndex to ensure correct discount assignment.
 */
const allocateDiscountsAcrossEligibleItems = (
  eligibleItems,
  totalDiscountMinorUnits
) => {
  if (!Array.isArray(eligibleItems) || eligibleItems.length === 0) {
    return new Map();
  }

  const discountMap = new Map();
  eligibleItems.forEach((item) => {
    discountMap.set(item.originalIndex, 0);
  });

  if (totalDiscountMinorUnits <= 0) {
    return discountMap;
  }

  const eligibleSubtotalMinorUnits = eligibleItems.reduce(
    (total, item) => total + item.lineTotalMinorUnits,
    0
  );

  if (eligibleSubtotalMinorUnits <= 0) {
    return discountMap;
  }

  const effectiveDiscountMinorUnits = Math.min(
    totalDiscountMinorUnits,
    eligibleSubtotalMinorUnits
  );

  let allocatedSum = 0;
  const fractions = [];

  eligibleItems.forEach((item) => {
    const rawShare =
      (item.lineTotalMinorUnits * effectiveDiscountMinorUnits) /
      eligibleSubtotalMinorUnits;
    const baseDiscount = Math.floor(rawShare);
    const fraction = rawShare - baseDiscount;

    discountMap.set(item.originalIndex, baseDiscount);
    allocatedSum += baseDiscount;
    fractions.push({ originalIndex: item.originalIndex, fraction });
  });

  let unallocatedUnits = effectiveDiscountMinorUnits - allocatedSum;

  // Sort by fraction descending; tie-breaker: originalIndex ascending
  fractions.sort(
    (a, b) => b.fraction - a.fraction || a.originalIndex - b.originalIndex
  );

  for (let i = 0; i < unallocatedUnits; i++) {
    const itemIndex = fractions[i % fractions.length].originalIndex;
    discountMap.set(itemIndex, discountMap.get(itemIndex) + 1);
  }

  return discountMap;
};

/**
 * Deterministic Two-Tier Tax Rule Matching
 *
 * Tier 1: Exact State Specificity
 * Tier 2: Country-Wide Fallback (state is null or empty)
 *
 * Within each tier, candidates are ranked by:
 * priority DESC -> updatedAt DESC -> _id DESC.
 */
const resolveTaxRule = async ({
  country,
  state = null,
  taxCategory = DEFAULT_TAX_CATEGORY,
  asOfDate = new Date(),
  session = null,
}) => {
  if (!country) {
    return null;
  }

  const normalizedCountry = String(country).trim().toUpperCase();
  const normalizedState = state ? String(state).trim().toUpperCase() : null;

  // 1. Try exact requested taxCategory
  const candidates = await taxRepository.findCandidateRules(
    {
      country: normalizedCountry,
      state: normalizedState,
      taxCategory,
      asOfDate,
    },
    { session }
  );

  // Tier 1: State-specific rules
  if (normalizedState) {
    const stateMatches = candidates.filter(
      (r) => r.state && r.state.toUpperCase() === normalizedState
    );
    if (stateMatches.length > 0) {
      // Best state rule (already sorted by priority DESC, updatedAt DESC, _id DESC)
      return stateMatches[0];
    }
  }

  // Tier 2: Country-wide rules
  const countryMatches = candidates.filter(
    (r) => !r.state || r.state.trim() === ""
  );
  if (countryMatches.length > 0) {
    return countryMatches[0];
  }

  // 2. If no rule matched and category is not standard, fallback to standard
  if (
    taxCategory !== DEFAULT_TAX_CATEGORY &&
    taxCategory !== TAX_CATEGORIES.EXEMPT &&
    taxCategory !== TAX_CATEGORIES.ZERO_RATED
  ) {
    return resolveTaxRule({
      country: normalizedCountry,
      state: normalizedState,
      taxCategory: DEFAULT_TAX_CATEGORY,
      asOfDate,
      session,
    });
  }

  return null;
};

/**
 * Calculate authoritative order taxes.
 *
 * @param {Object} params
 * @param {Array} params.items - Validated order items
 * @param {Object} params.shippingAddress - Customer destination address
 * @param {number} params.couponDiscountMinorUnits - Authoritative coupon discount in minor units
 * @param {number} params.shippingTotalMinorUnits - Authoritative shipping total in minor units
 * @param {string} params.pricingMode - "tax_exclusive" or "tax_inclusive"
 * @param {string} params.currency - ISO currency code
 * @param {Date} params.asOfDate - Calculation timestamp
 * @param {ClientSession} params.session - Optional MongoDB transaction session
 */
const calculateOrderTax = async ({
  items,
  shippingAddress,
  couponDiscountMinorUnits = 0,
  shippingTotalMinorUnits = 0,
  pricingMode = DEFAULT_TAX_PRICING_MODE,
  currency = "INR",
  asOfDate = new Date(),
  session = null,
}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(
      "Items are required for tax calculation",
      400,
      "TAX_ITEMS_REQUIRED"
    );
  }

  if (!ALLOWED_TAX_PRICING_MODES.includes(pricingMode)) {
    throw new AppError(
      `Invalid tax pricing mode: ${pricingMode}`,
      400,
      "INVALID_TAX_PRICING_MODE"
    );
  }

  const destinationCountry = shippingAddress?.country
    ? String(shippingAddress.country).trim().toUpperCase()
    : "IN";
  const destinationState = shippingAddress?.state
    ? String(shippingAddress.state).trim().toUpperCase()
    : null;

  // Prepare items with minor units
  const preparedItems = items.map((item, index) => {
    const unitPriceMinorUnits = decimalToMinorUnits(item.unitPrice);
    const lineTotalMinorUnits = unitPriceMinorUnits * item.quantity;
    const isTaxable =
      item.isTaxable !== undefined && item.isTaxable !== null
        ? Boolean(item.isTaxable)
        : true;
    const taxCategory =
      item.taxCategory && ALLOWED_TAX_CATEGORIES.includes(item.taxCategory)
        ? item.taxCategory
        : DEFAULT_TAX_CATEGORY;

    return {
      originalIndex: index,
      item,
      unitPriceMinorUnits,
      lineTotalMinorUnits,
      isTaxable,
      taxCategory,
      vendorId: item.vendorId || null,
    };
  });

  // Eligible items for coupon discount allocation
  const eligibleItems = preparedItems.filter(
    (pi) => pi.item.isCouponEligible !== false
  );

  const discountAllocationMap = allocateDiscountsAcrossEligibleItems(
    eligibleItems,
    couponDiscountMinorUnits
  );

  let itemsTaxTotalMinorUnits = 0;
  let highestPriorityShippingRule = null;

  const itemResults = [];

  for (let i = 0; i < preparedItems.length; i++) {
    const pi = preparedItems[i];
    const allocatedDiscountMinorUnits =
      discountAllocationMap.get(pi.originalIndex) || 0;

    let taxableBaseMinorUnits = 0;
    let taxRateDecimal = "0.00";
    let taxRateNumber = 0;
    let taxAmountMinorUnits = 0;
    let matchedRule = null;

    if (
      pi.isTaxable &&
      pi.taxCategory !== TAX_CATEGORIES.EXEMPT &&
      pi.taxCategory !== TAX_CATEGORIES.ZERO_RATED
    ) {
      taxableBaseMinorUnits = Math.max(
        0,
        pi.lineTotalMinorUnits - allocatedDiscountMinorUnits
      );

      matchedRule = await resolveTaxRule({
        country: destinationCountry,
        state: destinationState,
        taxCategory: pi.taxCategory,
        asOfDate,
        session,
      });

      if (matchedRule) {
        taxRateDecimal = matchedRule.rate.toString();
        taxRateNumber = Number(taxRateDecimal);

        if (matchedRule.isShippingTaxable) {
          if (
            !highestPriorityShippingRule ||
            matchedRule.priority > highestPriorityShippingRule.priority
          ) {
            highestPriorityShippingRule = matchedRule;
          }
        }

        if (taxRateNumber > 0 && taxableBaseMinorUnits > 0) {
          if (pricingMode === TAX_PRICING_MODES.TAX_EXCLUSIVE) {
            // Tax-exclusive: tax = round(taxableBase * rate / 100)
            taxAmountMinorUnits = Math.round(
              (taxableBaseMinorUnits * taxRateNumber) / 100
            );
          } else {
            // Tax-inclusive: tax = round(taxableBase * rate / (100 + rate))
            taxAmountMinorUnits = Math.round(
              (taxableBaseMinorUnits * taxRateNumber) / (100 + taxRateNumber)
            );
          }
        }
      }
    }

    itemsTaxTotalMinorUnits += taxAmountMinorUnits;

    itemResults.push({
      ...pi.item,
      discountTotal: minorUnitsToDecimalString(allocatedDiscountMinorUnits),
      taxTotal: minorUnitsToDecimalString(taxAmountMinorUnits),
      taxDetails: {
        taxRuleId: matchedRule ? matchedRule._id : null,
        ruleName: matchedRule ? matchedRule.name : null,
        jurisdictionCountry: destinationCountry,
        jurisdictionState: destinationState,
        taxCategory: pi.taxCategory,
        isTaxable: pi.isTaxable,
        pricingMode,
        taxRate: mongoose.Types.Decimal128.fromString(taxRateDecimal),
        taxableBase: mongoose.Types.Decimal128.fromString(
          minorUnitsToDecimalString(taxableBaseMinorUnits)
        ),
        taxAmount: mongoose.Types.Decimal128.fromString(
          minorUnitsToDecimalString(taxAmountMinorUnits)
        ),
      },
    });
  }

  // Calculate shipping tax if shipping charges exist and shipping is taxable.
  // Note: Buybox-Ecommerce currently defaults shippingTotalMinorUnits to 0.
  // If shippingTotalMinorUnits is 0, shippingTaxTotalMinorUnits is 0.
  let shippingTaxTotalMinorUnits = 0;
  if (shippingTotalMinorUnits > 0 && highestPriorityShippingRule) {
    const shippingRateNumber = Number(
      highestPriorityShippingRule.rate.toString()
    );
    if (shippingRateNumber > 0) {
      if (pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE) {
        shippingTaxTotalMinorUnits = Math.round(
          (shippingTotalMinorUnits * shippingRateNumber) /
            (100 + shippingRateNumber)
        );
      } else {
        shippingTaxTotalMinorUnits = Math.round(
          (shippingTotalMinorUnits * shippingRateNumber) / 100
        );
      }
    }
  }

  const totalTaxMinorUnits =
    itemsTaxTotalMinorUnits + shippingTaxTotalMinorUnits;

  return {
    pricingMode,
    currency,
    jurisdictionCountry: destinationCountry,
    jurisdictionState: destinationState,
    items: itemResults,
    itemsTaxTotal: minorUnitsToDecimalString(itemsTaxTotalMinorUnits),
    shippingTaxTotal: minorUnitsToDecimalString(shippingTaxTotalMinorUnits),
    totalTax: minorUnitsToDecimalString(totalTaxMinorUnits),
    itemsTaxTotalMinorUnits,
    shippingTaxTotalMinorUnits,
    totalTaxMinorUnits,
    taxSnapshot: {
      jurisdictionCountry: destinationCountry,
      jurisdictionState: destinationState,
      calculatedAt: asOfDate,
      itemsTaxTotal: mongoose.Types.Decimal128.fromString(
        minorUnitsToDecimalString(itemsTaxTotalMinorUnits)
      ),
      shippingTaxTotal: mongoose.Types.Decimal128.fromString(
        minorUnitsToDecimalString(shippingTaxTotalMinorUnits)
      ),
      totalTax: mongoose.Types.Decimal128.fromString(
        minorUnitsToDecimalString(totalTaxMinorUnits)
      ),
      pricingMode,
    },
  };
};

/* ==================== TAX RULE CRUD ==================== */

const createTaxRule = async (data, options = {}) => {
  const taxCategory = data.taxCategory || DEFAULT_TAX_CATEGORY;

  if (!ALLOWED_TAX_CATEGORIES.includes(taxCategory)) {
    throw new AppError(
      `Invalid tax category: ${taxCategory}`,
      400,
      "INVALID_TAX_CATEGORY"
    );
  }

  const rateNumber = Number(data.rate);
  if (!Number.isFinite(rateNumber) || rateNumber < 0 || rateNumber > 100) {
    throw new AppError(
      "Tax rate must be between 0 and 100",
      400,
      "INVALID_TAX_RATE"
    );
  }

  // Check for conflicting active rule with identical tuple and priority
  if (data.isActive !== false) {
    const conflict = await taxRepository.findConflictingRule({
      country: data.country,
      state: data.state || null,
      taxCategory,
      priority: data.priority || 0,
      startsAt: data.startsAt || null,
      expiresAt: data.expiresAt || null,
    });

    if (conflict) {
      throw new AppError(
        "An active tax rule already exists for this jurisdiction, category, and priority with overlapping dates",
        409,
        "TAX_RULE_OVERLAP_CONFLICT"
      );
    }
  }

  return taxRepository.create(
    {
      ...data,
      country: String(data.country).trim().toUpperCase(),
      state: data.state ? String(data.state).trim().toUpperCase() : null,
      taxCategory,
      rate: mongoose.Types.Decimal128.fromString(rateNumber.toFixed(2)),
      priority: data.priority ? parseInt(data.priority, 10) : 0,
    },
    options
  );
};

const getTaxRules = async (filter = {}) => {
  return taxRepository.findMany(filter);
};

const getTaxRuleById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid tax rule ID", 400, "INVALID_TAX_RULE_ID");
  }

  const rule = await taxRepository.findById(id);
  if (!rule) {
    throw new AppError("Tax rule not found", 404, "TAX_RULE_NOT_FOUND");
  }

  return rule;
};

const updateTaxRule = async (id, data, options = {}) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid tax rule ID", 400, "INVALID_TAX_RULE_ID");
  }

  const rule = await taxRepository.findById(id);
  if (!rule) {
    throw new AppError("Tax rule not found", 404, "TAX_RULE_NOT_FOUND");
  }

  const update = { ...data };

  if (update.taxCategory) {
    if (!ALLOWED_TAX_CATEGORIES.includes(update.taxCategory)) {
      throw new AppError(
        `Invalid tax category: ${update.taxCategory}`,
        400,
        "INVALID_TAX_CATEGORY"
      );
    }
  }

  if (update.rate !== undefined) {
    const rateNumber = Number(update.rate);
    if (!Number.isFinite(rateNumber) || rateNumber < 0 || rateNumber > 100) {
      throw new AppError(
        "Tax rate must be between 0 and 100",
        400,
        "INVALID_TAX_RATE"
      );
    }
    update.rate = mongoose.Types.Decimal128.fromString(rateNumber.toFixed(2));
  }

  if (update.country) {
    update.country = String(update.country).trim().toUpperCase();
  }

  if (update.state !== undefined) {
    update.state = update.state
      ? String(update.state).trim().toUpperCase()
      : null;
  }

  // If changing active status or jurisdiction/priority/dates, check conflict
  const isBecomingActive =
    update.isActive !== undefined ? update.isActive : rule.isActive;

  if (isBecomingActive) {
    const conflict = await taxRepository.findConflictingRule({
      country: update.country || rule.country,
      state:
        update.state !== undefined
          ? update.state
          : rule.state,
      taxCategory: update.taxCategory || rule.taxCategory,
      priority:
        update.priority !== undefined ? update.priority : rule.priority,
      startsAt:
        update.startsAt !== undefined ? update.startsAt : rule.startsAt,
      expiresAt:
        update.expiresAt !== undefined ? update.expiresAt : rule.expiresAt,
      excludeId: rule._id,
    });

    if (conflict) {
      throw new AppError(
        "An active tax rule already exists for this jurisdiction, category, and priority with overlapping dates",
        409,
        "TAX_RULE_OVERLAP_CONFLICT"
      );
    }
  }

  return taxRepository.updateById(id, update, options);
};

const deleteTaxRule = async (id, options = {}) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid tax rule ID", 400, "INVALID_TAX_RULE_ID");
  }

  const rule = await taxRepository.findById(id);
  if (!rule) {
    throw new AppError("Tax rule not found", 404, "TAX_RULE_NOT_FOUND");
  }

  return taxRepository.softDeleteById(id, options);
};

module.exports = {
  calculateOrderTax,
  resolveTaxRule,
  allocateDiscountsAcrossEligibleItems,
  createTaxRule,
  getTaxRules,
  getTaxRuleById,
  updateTaxRule,
  deleteTaxRule,
  decimalToMinorUnits,
  minorUnitsToDecimalString,
};
