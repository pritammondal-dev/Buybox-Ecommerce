/**
 * Buybox Ecommerce - Frontend Attribute & Variation Utilities
 * Phase 2D: Vendor Variant Management & SKU Control Workflows
 */

/**
 * Normalizes attributes from plain object, Map, or legacy array into a standard plain object { [name]: value }.
 * @param {Object|Map|Array} attributes
 * @returns {Record<string, string>}
 */
export function normalizeAttributes(attributes) {
  if (!attributes) return {};

  if (attributes instanceof Map) {
    const res = {};
    for (const [key, val] of attributes.entries()) {
      if (key && val !== undefined && val !== null) {
        res[String(key).trim()] = String(val).trim();
      }
    }
    return res;
  }

  if (Array.isArray(attributes)) {
    const res = {};
    for (const item of attributes) {
      if (!item) continue;
      const k = item.name || item.key || item.attributeName;
      const v = item.value || item.val || item.attributeValue;
      if (k && v !== undefined && v !== null) {
        res[String(k).trim()] = String(v).trim();
      }
    }
    return res;
  }

  if (typeof attributes === "object") {
    const res = {};
    for (const [key, val] of Object.entries(attributes)) {
      if (key && val !== undefined && val !== null) {
        res[String(key).trim()] = String(val).trim();
      }
    }
    return res;
  }

  return {};
}

/**
 * Generates display text or badges for a variant's attributes.
 * @param {Object|Map|Array} attributes
 * @returns {Array<{ name: string, value: string }>}
 */
export function getAttributeEntries(attributes) {
  const norm = normalizeAttributes(attributes);
  return Object.entries(norm).map(([name, value]) => ({ name, value }));
}

/**
 * Serializes attributes to a single canonical display string (e.g. "Color: Red, Size: M").
 * @param {Object|Map|Array} attributes
 * @returns {string}
 */
export function formatAttributesString(attributes) {
  const entries = getAttributeEntries(attributes);
  if (entries.length === 0) return "Standard";
  return entries.map((e) => `${e.name}: ${e.value}`).join(", ");
}

/**
 * Deterministic fingerprint for attribute combinations to detect duplicates.
 * @param {Object|Map|Array} attributes
 * @returns {string}
 */
export function getCombinationFingerprint(attributes) {
  const norm = normalizeAttributes(attributes);
  const keys = Object.keys(norm).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  return keys
    .map((k) => `${k.toLowerCase().trim()}:${String(norm[k]).toLowerCase().trim()}`)
    .join("|");
}

/**
 * Calculates the Cartesian product of defined attributes.
 * @param {Array<{ name: string, values: string[] }>} attributeDefinitions
 * @returns {Array<Record<string, string>>}
 */
export function generateCartesianCombinations(attributeDefinitions = []) {
  const validAttrs = attributeDefinitions
    .map((attr) => ({
      name: (attr.name || "").trim(),
      values: Array.isArray(attr.values)
        ? attr.values.map((v) => String(v).trim()).filter(Boolean)
        : [],
    }))
    .filter((attr) => attr.name && attr.values.length > 0);

  if (validAttrs.length === 0) return [];

  let combinations = [{}];

  for (const attr of validAttrs) {
    const nextCombos = [];
    for (const existing of combinations) {
      for (const val of attr.values) {
        nextCombos.push({
          ...existing,
          [attr.name]: val,
        });
      }
    }
    combinations = nextCombos;
  }

  return combinations;
}

/**
 * Estimates total combinations for a set of attribute definitions.
 * @param {Array<{ name: string, values: string[] }>} attributeDefinitions
 * @returns {{ count: number, exceedsLimit: boolean, maxLimit: number }}
 */
export function estimateCombinationCount(attributeDefinitions = [], maxLimit = 100) {
  const validAttrs = attributeDefinitions.filter(
    (attr) => attr.name?.trim() && Array.isArray(attr.values) && attr.values.filter(Boolean).length > 0
  );

  if (validAttrs.length === 0) {
    return { count: 0, exceedsLimit: false, maxLimit };
  }

  const count = validAttrs.reduce((acc, attr) => {
    const valCount = attr.values.filter(Boolean).length;
    return acc * valCount;
  }, 1);

  return {
    count,
    exceedsLimit: count > maxLimit,
    maxLimit,
  };
}

/**
 * Suggests a unique SKU code given the parent SKU and combination attributes.
 * @param {string} parentSku
 * @param {Record<string, string>} combination
 * @returns {string}
 */
export function suggestVariantSku(parentSku = "SKU", combination = {}) {
  const cleanParent = (parentSku || "SKU").trim().toUpperCase();
  const parts = Object.values(combination)
    .map((v) =>
      String(v)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 4)
    )
    .filter(Boolean);

  if (parts.length === 0) {
    return `${cleanParent}-VAR`;
  }

  return `${cleanParent}-${parts.join("-")}`;
}
