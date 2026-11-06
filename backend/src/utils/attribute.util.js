/**
 * Attribute Normalization & Combination Utilities
 *
 * Provides bidirectional normalization between Mongoose Maps, plain objects,
 * and legacy attribute arrays, alongside canonical combination serialization.
 */

/**
 * Safely normalizes variant attributes from Map, Array, or Object
 * into a standard key-value plain object: { [attrName]: attrValue }
 *
 * @param {Map|Array|Object|null|undefined} attributes
 * @returns {Record<string, string>}
 */
function normalizeVariantAttributes(attributes) {
  if (!attributes) return {};

  if (attributes instanceof Map) {
    const obj = {};
    for (const [k, v] of attributes.entries()) {
      if (v !== undefined && v !== null) {
        const key = String(k).trim();
        const val = String(v).trim();
        if (key && val) obj[key] = val;
      }
    }
    return obj;
  }

  if (Array.isArray(attributes)) {
    const obj = {};
    for (const item of attributes) {
      if (item && typeof item === "object") {
        const key = item.name || item.key || item.attributeName;
        const val = item.value || item.attributeValue;
        if (key && val !== undefined && val !== null) {
          const cleanKey = String(key).trim();
          const cleanVal = String(val).trim();
          if (cleanKey && cleanVal) obj[cleanKey] = cleanVal;
        }
      }
    }
    return obj;
  }

  if (typeof attributes === "object") {
    const obj = {};
    for (const [k, v] of Object.entries(attributes)) {
      if (v !== undefined && v !== null) {
        const key = String(k).trim();
        const val = String(v).trim();
        if (key && val) obj[key] = val;
      }
    }
    return obj;
  }

  return {};
}

/**
 * Produces a canonical fingerprint string for an attribute combination.
 * Keys are sorted alphabetically and lowercased for deterministic comparison.
 * e.g. { Size: "M", Color: "Red" } -> "color:red|size:m"
 *
 * @param {Map|Array|Object|null|undefined} attributes
 * @returns {string} Canonical combination key
 */
function serializeAttributeCombination(attributes) {
  const normalized = normalizeVariantAttributes(attributes);
  const keys = Object.keys(normalized).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  if (keys.length === 0) return "";

  return keys
    .map((k) => `${k.toLowerCase().trim()}:${normalized[k].toLowerCase().trim()}`)
    .join("|");
}

/**
 * Compares two attribute combinations for canonical semantic equality.
 *
 * @param {any} attrsA
 * @param {any} attrsB
 * @returns {boolean}
 */
function combinationsAreEqual(attrsA, attrsB) {
  return serializeAttributeCombination(attrsA) === serializeAttributeCombination(attrsB);
}

module.exports = {
  normalizeVariantAttributes,
  serializeAttributeCombination,
  combinationsAreEqual,
};
