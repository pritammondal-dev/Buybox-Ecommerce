/**
 * Utility functions for safe category URL and slug resolution.
 * Prevents Next.js dynamic href '/category/[object Object]' runtime exceptions.
 */

/**
 * Safely extracts a clean string slug or identifier from category inputs.
 * Handles strings, category objects with .slug, and fallback to string ._id / .id.
 * Explicitly rejects "[object Object]" strings, non-string objects, or unresolvable values.
 *
 * @param {string|object|null|undefined} cat - Category input
 * @returns {string|null} - Clean non-empty string slug or null if unresolvable
 */
export function getCategorySlug(cat) {
  if (!cat) return null;

  if (typeof cat === "string") {
    const trimmed = cat.trim();
    if (trimmed && trimmed !== "[object Object]" && !trimmed.startsWith("[object")) {
      return trimmed;
    }
    return null;
  }

  if (typeof cat === "object") {
    // 1. Prefer slug property if valid string
    if (typeof cat.slug === "string") {
      const trimmedSlug = cat.slug.trim();
      if (trimmedSlug && trimmedSlug !== "[object Object]" && !trimmedSlug.startsWith("[object")) {
        return trimmedSlug;
      }
    }

    // 2. Fallback to _id if valid string
    if (typeof cat._id === "string") {
      const trimmedId = cat._id.trim();
      if (trimmedId && trimmedId !== "[object Object]" && !trimmedId.startsWith("[object")) {
        return trimmedId;
      }
    }

    // 3. Fallback to id if valid string
    if (typeof cat.id === "string") {
      const trimmedId = cat.id.trim();
      if (trimmedId && trimmedId !== "[object Object]" && !trimmedId.startsWith("[object")) {
        return trimmedId;
      }
    }
  }

  return null;
}

/**
 * Returns a safe href for category navigation.
 * Defaults to fallbackUrl (default: "/shop") if the category cannot be resolved.
 *
 * @param {string|object|null|undefined} cat - Category input
 * @param {string} [fallbackUrl="/shop"] - Safe fallback if invalid
 * @returns {string} - Safe category URL
 */
export function getCategoryHref(cat, fallbackUrl = "/shop") {
  const slug = getCategorySlug(cat);
  if (!slug) {
    return fallbackUrl;
  }
  return `/category/${encodeURIComponent(slug)}`;
}

/**
 * Safely extracts a clean string ID from a category or categoryId property.
 * Handles both raw string IDs and populated Mongoose category objects.
 *
 * @param {string|object|null|undefined} cat - Category ID or populated category object
 * @returns {string|null} - Clean string ID or null
 */
export function getCategoryId(cat) {
  if (!cat) return null;

  if (typeof cat === "string") {
    const trimmed = cat.trim();
    if (trimmed && trimmed !== "[object Object]" && !trimmed.startsWith("[object")) {
      return trimmed;
    }
    return null;
  }

  if (typeof cat === "object") {
    if (typeof cat._id === "string") {
      const trimmed = cat._id.trim();
      if (trimmed && trimmed !== "[object Object]") return trimmed;
    }
    if (typeof cat.id === "string") {
      const trimmed = cat.id.trim();
      if (trimmed && trimmed !== "[object Object]") return trimmed;
    }
  }

  return null;
}

/**
 * Safely extracts a clean string ID from a brand or brandId property.
 * Handles both raw string IDs and populated Mongoose brand objects.
 *
 * @param {string|object|null|undefined} brand - Brand ID or populated brand object
 * @returns {string|null} - Clean string ID or null
 */
export function getBrandId(brand) {
  if (!brand) return null;

  if (typeof brand === "string") {
    const trimmed = brand.trim();
    if (trimmed && trimmed !== "[object Object]" && !trimmed.startsWith("[object")) {
      return trimmed;
    }
    return null;
  }

  if (typeof brand === "object") {
    if (typeof brand._id === "string") {
      const trimmed = brand._id.trim();
      if (trimmed && trimmed !== "[object Object]") return trimmed;
    }
    if (typeof brand.id === "string") {
      const trimmed = brand.id.trim();
      if (trimmed && trimmed !== "[object Object]") return trimmed;
    }
  }

  return null;
}

