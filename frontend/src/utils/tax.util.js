/**
 * Safely extracts a display-safe decimal string from any tax decimal field.
 * Guarantees that raw BSON Extended JSON objects such as { $numberDecimal: "18.00" }
 * or arbitrary objects are never passed into JSX as React children.
 *
 * Preserves:
 * - Valid zero values ("0", 0, "0.00")
 * - Full string precision ("18.00", "5.50")
 * - Handles null, undefined, or empty values by returning the fallback (default "0")
 * - Never returns "[object Object]"
 *
 * @param {*} value - The rate or decimal value to format.
 * @param {string} [fallback="0"] - Fallback string if value is null or invalid.
 * @returns {string} Safe display string.
 */
export function formatTaxDecimal(value, fallback = "0") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  // Handle Extended JSON: { $numberDecimal: "18.00" }
  if (typeof value === "object") {
    if (value.$numberDecimal !== undefined && value.$numberDecimal !== null) {
      return String(value.$numberDecimal);
    }
    // Prevent any other arbitrary object from rendering as [object Object]
    return fallback;
  }

  return String(value);
}

/**
 * Normalizes a tax rule object or collection at the API or data adapter boundary.
 * Unwraps any Decimal128 Extended JSON values ({ $numberDecimal: "..." })
 * into canonical decimal strings and harmonizes boolean flags.
 *
 * @param {Object} rule - Tax rule object.
 * @returns {Object} Normalized tax rule.
 */
export function normalizeTaxRule(rule) {
  if (!rule || typeof rule !== "object") {
    return rule;
  }

  const normalized = { ...rule };

  // Unwrap any Decimal128 Extended JSON objects on any field
  for (const [key, val] of Object.entries(normalized)) {
    if (val && typeof val === "object" && typeof val.$numberDecimal === "string") {
      normalized[key] = val.$numberDecimal;
    }
  }

  // Ensure rate is always a clean string
  if (normalized.rate !== undefined && normalized.rate !== null) {
    normalized.rate = formatTaxDecimal(normalized.rate, "0");
  }

  // Harmonize shipping taxable boolean flags
  if (normalized.isShippingTaxable === undefined && normalized.shippingTaxable !== undefined) {
    normalized.isShippingTaxable = Boolean(normalized.shippingTaxable);
  }

  return normalized;
}

/**
 * Normalizes an array or single tax rule.
 *
 * @param {Array|Object} data - Tax rules list or single rule.
 * @returns {Array|Object} Normalized list or rule.
 */
export function normalizeTaxRules(data) {
  if (Array.isArray(data)) {
    return data.map(normalizeTaxRule);
  }
  return normalizeTaxRule(data);
}
