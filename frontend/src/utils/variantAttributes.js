/**
 * Safely normalizes variant attributes from Map, Array, or Object
 * into a standard key-value object: { [attrName]: attrValue }
 *
 * @param {Map|Array|Object|null|undefined} attributes
 * @returns {Record<string, string>}
 */
export function normalizeVariantAttributes(attributes) {
  if (!attributes) return {};
  if (attributes instanceof Map) {
    return Object.fromEntries(attributes);
  }
  if (Array.isArray(attributes)) {
    const obj = {};
    for (const item of attributes) {
      if (item && typeof item === "object") {
        const key = item.name || item.key || item.attributeName;
        const val = item.value || item.attributeValue;
        if (key && val !== undefined && val !== null) {
          obj[String(key).trim()] = String(val).trim();
        }
      }
    }
    return obj;
  }
  if (typeof attributes === "object") {
    const obj = {};
    for (const [k, v] of Object.entries(attributes)) {
      if (v !== undefined && v !== null) {
        obj[String(k).trim()] = String(v).trim();
      }
    }
    return obj;
  }
  return {};
}

export default normalizeVariantAttributes;
