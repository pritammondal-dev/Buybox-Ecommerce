/**
 * Recently Viewed Products Utility
 *
 * Persists lightweight product identifiers in localStorage
 * to power the customer Recently Viewed homepage section.
 */

const RECENTLY_VIEWED_KEY = "buybox_recently_viewed";
const MAX_RECENTLY_VIEWED = 10;

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

/**
 * Record a viewed product ID into recent view history
 * Moves most recently viewed ID to the front, deduplicates, and limits size
 * @param {string} productId
 */
export function recordRecentlyViewed(productId) {
  if (!productId || typeof productId !== "string") return;

  const cleanId = productId.trim();
  if (!cleanId) return;

  const storage = getStorage();
  if (!storage) return;

  try {
    const stored = storage.getItem(RECENTLY_VIEWED_KEY);
    const existing = stored ? JSON.parse(stored) : [];
    const validList = Array.isArray(existing) ? existing : [];

    // Filter out duplicate and insert at front
    const filtered = validList.filter((id) => id !== cleanId);
    const updated = [cleanId, ...filtered].slice(0, MAX_RECENTLY_VIEWED);

    storage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {
    // Graceful fallback for private browsing / quota errors
  }
}

/**
 * Retrieve the list of recently viewed product IDs
 * @returns {string[]}
 */
export function getRecentlyViewedIds() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const stored = storage.getItem(RECENTLY_VIEWED_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Remove an invalid or deleted product ID from history
 * @param {string} productId
 */
export function removeRecentlyViewedId(productId) {
  if (!productId) return;

  const storage = getStorage();
  if (!storage) return;

  try {
    const stored = storage.getItem(RECENTLY_VIEWED_KEY);
    const existing = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(existing)) return;

    const updated = existing.filter((id) => id !== String(productId));
    storage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear the entire recently viewed history
 */
export function clearRecentlyViewed() {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(RECENTLY_VIEWED_KEY);
  } catch {
    // Ignore localStorage errors
  }
}
