/**
 * Reusable Pagination Utilities
 */

/**
 * Generates an array of page numbers and ellipsis strings for pagination.
 * e.g. [1, 2, 3, 4, 5, '...', 20] or [1, '...', 4, 5, 6, '...', 20]
 *
 * @param {number} currentPage
 * @param {number} totalPages
 * @param {number} siblingCount
 * @returns {(number|string)[]}
 */
export function getPaginationRange(currentPage, totalPages, siblingCount = 1) {
  const safeTotal = Math.max(1, Number(totalPages) || 1);
  const safeCurrent = Math.min(Math.max(1, Number(currentPage) || 1), safeTotal);

  // Threshold to show all pages without ellipsis (1 + 2*siblings + 2 edges + 2 buffer = 7)
  const totalNumbers = siblingCount * 2 + 5;
  if (safeTotal <= totalNumbers) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(safeCurrent - siblingCount, 1);
  const rightSiblingIndex = Math.min(safeCurrent + siblingCount, safeTotal);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < safeTotal - 1;

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "...", safeTotal];
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => safeTotal - rightItemCount + 1 + i
    );
    return [1, "...", ...rightRange];
  }

  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    );
    return [1, "...", ...middleRange, "...", safeTotal];
  }

  return Array.from({ length: safeTotal }, (_, i) => i + 1);
}

/**
 * Calculates start and end record indices for display (e.g. Showing 1-20 of 50).
 *
 * @param {number} page
 * @param {number} limit
 * @param {number} total
 * @returns {{ startRecord: number, endRecord: number, totalPages: number }}
 */
export function calculateRecordRange(page, limit, total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit) || 1);
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const startRecord = safeTotal === 0 ? 0 : (safePage - 1) * safeLimit + 1;
  const endRecord = Math.min(safePage * safeLimit, safeTotal);

  return { startRecord, endRecord, totalPages, safePage };
}

