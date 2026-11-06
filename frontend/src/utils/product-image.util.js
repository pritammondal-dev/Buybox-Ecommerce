/**
 * Product Image and Catalog Utility Helpers
 * Supports Phase 2L.1 Administrator Catalog Remediation (DEF-001, DEF-002, DEF-005, DEF-007, DEF-008, DEF-009)
 */

/**
 * Safely extracts a thumbnail image URL from a product object.
 * Handles subdocument { url, publicId, altText, sortOrder }, legacy strings,
 * null/undefined, empty strings, whitespace, and empty objects.
 * Returns null if no valid image URL exists.
 *
 * @param {Object} product - Product document or object
 * @returns {string|null} - Normalized URL string or null
 */
export function extractProductThumbnailUrl(product) {
  if (!product || typeof product !== "object") return null;

  // 1. Check primaryImage field (handles subdocument { url, ... } and legacy string)
  if (typeof product.primaryImage === "string" && product.primaryImage.trim()) {
    return product.primaryImage.trim();
  }
  if (
    product.primaryImage &&
    typeof product.primaryImage === "object" &&
    typeof product.primaryImage.url === "string" &&
    product.primaryImage.url.trim()
  ) {
    return product.primaryImage.url.trim();
  }

  // 2. Check images array (handles subdocument { url, sortOrder, ... } and legacy strings)
  if (Array.isArray(product.images) && product.images.length > 0) {
    for (const img of product.images) {
      if (!img) continue;
      if (typeof img === "string" && img.trim()) {
        return img.trim();
      }
      if (
        typeof img === "object" &&
        typeof img.url === "string" &&
        img.url.trim()
      ) {
        return img.url.trim();
      }
    }
  }

  // 3. Check thumbnail field
  if (typeof product.thumbnail === "string" && product.thumbnail.trim()) {
    return product.thumbnail.trim();
  }
  if (
    product.thumbnail &&
    typeof product.thumbnail === "object" &&
    typeof product.thumbnail.url === "string" &&
    product.thumbnail.url.trim()
  ) {
    return product.thumbnail.url.trim();
  }

  return null;
}

/**
 * Normalizes and collects gallery images from a product and its variants.
 * Handles subdocuments { url, altText, sortOrder, publicId }, legacy strings,
 * null/undefined/empty objects, and variant-specific images.
 *
 * @param {Object} product - Product document or object
 * @returns {Array<Object>} - Array of normalized gallery image items
 */
export function collectProductGalleryImages(product) {
  if (!product || typeof product !== "object") return [];
  const gallery = [];
  const seenUrls = new Set();

  const addImage = (img, sourceLabel, variantSku = null) => {
    if (!img) return;
    let url = null;
    let altText = product.name || product.title || "Product image";
    let sortOrder = 0;

    if (typeof img === "string" && img.trim()) {
      url = img.trim();
    } else if (typeof img === "object") {
      const candidate = img.url || img.secureUrl || img.src;
      if (typeof candidate === "string" && candidate.trim()) {
        url = candidate.trim();
      }
      if (typeof img.altText === "string" && img.altText.trim()) {
        altText = img.altText.trim();
      }
      if (typeof img.sortOrder === "number") {
        sortOrder = img.sortOrder;
      }
    }

    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      gallery.push({
        url,
        altText,
        sortOrder,
        sourceLabel,
        variantSku,
      });
    }
  };

  // 1. Process product.images (sort by sortOrder)
  if (Array.isArray(product.images)) {
    const sorted = [...product.images].sort((a, b) => {
      const orderA =
        typeof a === "object" && typeof a?.sortOrder === "number"
          ? a.sortOrder
          : 0;
      const orderB =
        typeof b === "object" && typeof b?.sortOrder === "number"
          ? b.sortOrder
          : 0;
      return orderA - orderB;
    });
    sorted.forEach((img, idx) => {
      addImage(img, idx === 0 ? "Primary Image" : `Gallery #${idx + 1}`);
    });
  }

  // 2. Check primaryImage / image / thumbnail if not already captured
  if (product.primaryImage) addImage(product.primaryImage, "Primary Image");
  if (product.image) addImage(product.image, "Product Image");
  if (product.thumbnail) addImage(product.thumbnail, "Thumbnail");

  // 3. Variant images
  if (Array.isArray(product.variants)) {
    product.variants.forEach((v) => {
      const sku = v.sku || "Variant";
      if (v.image) {
        addImage(v.image, `Variant (${sku})`, sku);
      }
      if (Array.isArray(v.images)) {
        v.images.forEach((vImg, vIdx) => {
          addImage(vImg, `Variant (${sku}) #${vIdx + 1}`, sku);
        });
      }
    });
  }

  return gallery;
}

/**
 * Defensive parser for backend bulk operation response envelope.
 * Canonical response shape:
 * {
 *   summary: { total: N, succeeded: N, failed: N },
 *   results: [{ id: "...", status: "...", message: "...", error: "..." }]
 * }
 *
 * @param {Object} rawResponse - Response object from admin bulk operation API
 * @returns {Object} - Parsed report { total, succeeded, failed, results }
 */
export function parseBulkOperationReport(rawResponse) {
  if (!rawResponse || typeof rawResponse !== "object") {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  const total =
    rawResponse.summary?.total ??
    rawResponse.total ??
    (Array.isArray(rawResponse.results) ? rawResponse.results.length : 0);

  const succeeded =
    rawResponse.summary?.succeeded ??
    rawResponse.succeeded ??
    (Array.isArray(rawResponse.results)
      ? rawResponse.results.filter((r) => r.status === "succeeded").length
      : 0);

  const failed =
    rawResponse.summary?.failed ??
    rawResponse.failed ??
    (Array.isArray(rawResponse.results)
      ? rawResponse.results.filter((r) => r.status === "failed").length
      : 0);

  const results = (rawResponse.results || []).map((r) => ({
    id: r.id || r.productId || "unknown",
    status: r.status,
    message: r.message || (r.status === "succeeded" ? "Completed" : "Failed"),
    error: r.error || null,
  }));

  return { total, succeeded, failed, results };
}

/**
 * Computes status counts and available actions for selected catalog products.
 * Prevents approving drafts directly and computes appropriate user warnings.
 *
 * @param {Array<Object>} selectedProducts - Selected product objects
 * @returns {Object} - Availability flags and explanation messages
 */
export function computeBulkActionAvailability(selectedProducts) {
  if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
    return {
      statusCounts: {},
      canSubmitForReview: false,
      canApprove: false,
      approveDisabledReason: null,
    };
  }

  const statusCounts = {};
  selectedProducts.forEach((p) => {
    const s = p?.status || "unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const hasDrafts = (statusCounts["draft"] || 0) > 0;
  const hasPending = (statusCounts["pending_approval"] || 0) > 0;
  const hasRejected = (statusCounts["rejected"] || 0) > 0;

  return {
    statusCounts,
    canSubmitForReview: hasDrafts || hasRejected,
    canApprove: hasPending && !hasDrafts,
    approveDisabledReason: hasDrafts
      ? "Selection includes draft products. Draft products must be submitted for review before they can be approved."
      : null,
  };
}
