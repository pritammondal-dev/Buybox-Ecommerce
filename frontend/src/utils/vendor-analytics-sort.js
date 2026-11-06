/**
 * Canonical sort options and parameter normalizers for Vendor Analytics.
 * Strictly adheres to backend Zod validation schema:
 *   sortBy: z.enum(["unitsSold", "grossSales", "netSales", "productName"]).default("unitsSold")
 *   sortOrder: z.enum(["asc", "desc"]).default("desc")
 */

export const CANONICAL_SORT_FIELDS = Object.freeze([
  "unitsSold",
  "grossSales",
  "netSales",
  "productName",
]);

export const CANONICAL_SORT_ORDERS = Object.freeze(["asc", "desc"]);
export const DEFAULT_SORT_BY = "unitsSold";
export const DEFAULT_SORT_ORDER = "desc";

/**
 * Normalizes any legacy or combined sort parameters into strictly valid canonical format.
 * 
 * @param {string} rawSortBy - Raw sort field, e.g. "unitsSold", "units", "units:desc", "grossSales:asc"
 * @param {string} rawSortOrder - Raw direction, e.g. "asc" or "desc"
 * @returns {{ sortBy: string, sortOrder: string }}
 */
export function normalizeSortParams(rawSortBy, rawSortOrder = DEFAULT_SORT_ORDER) {
  let field = typeof rawSortBy === "string" ? rawSortBy.trim() : DEFAULT_SORT_BY;
  let order = typeof rawSortOrder === "string" ? rawSortOrder.trim().toLowerCase() : DEFAULT_SORT_ORDER;

  // Handle combined legacy format like "unitsSold:desc", "units:desc", "orders:desc"
  if (field.includes(":")) {
    const parts = field.split(":");
    field = parts[0]?.trim() || DEFAULT_SORT_BY;
    if (parts[1] && CANONICAL_SORT_ORDERS.includes(parts[1].trim().toLowerCase())) {
      order = parts[1].trim().toLowerCase();
    }
  }

  // Map known obsolete/legacy values to canonical contract
  const legacyMap = {
    units: "unitsSold",
    unitssold: "unitsSold",
    orders: "unitsSold",
    gross: "grossSales",
    revenue: "grossSales",
    net: "netSales",
    name: "productName",
    title: "productName",
    product_name: "productName",
  };

  if (legacyMap[field.toLowerCase()]) {
    field = legacyMap[field.toLowerCase()];
  }

  if (!CANONICAL_SORT_FIELDS.includes(field)) {
    field = DEFAULT_SORT_BY;
  }

  if (!CANONICAL_SORT_ORDERS.includes(order)) {
    order = DEFAULT_SORT_ORDER;
  }

  return { sortBy: field, sortOrder: order };
}

