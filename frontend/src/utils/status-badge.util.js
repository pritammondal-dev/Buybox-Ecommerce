/**
 * Semantic style mappings for Vendor Status Badges
 * Buybox Marketplace Design Standard
 */
export const STATUS_STYLES = {
  // Positive / Successful / Active
  emerald: {
    bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  // In-progress / Neutral Information
  blue: {
    bg: "bg-blue-50 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
  },
  // Pending Action / Attention / Review
  amber: {
    bg: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  // Error / Out of stock / Cancelled / Rejected
  rose: {
    bg: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
  },
  // Special / High Priority / Variable
  purple: {
    bg: "bg-purple-50 text-purple-800 border-purple-200",
    dot: "bg-purple-500",
  },
  // Inactive / Muted / Draft
  slate: {
    bg: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
};

/**
 * Resolves semantic color category and humanized label from raw status code
 * @param {string} rawStatus - Status string from backend
 * @param {string} [entityType="general"] - Entity context ('order', 'catalog', 'inventory', 'shipment', 'return', 'finance')
 * @returns {{ variant: string, label: string }}
 */
export function resolveStatusMeta(rawStatus = "", entityType = "general") {
  const norm = String(rawStatus || "unknown").toLowerCase().trim();

  // 1. Orders
  if (norm === "delivered" || norm === "fulfilled") {
    return { variant: "emerald", label: "Fulfilled" };
  }
  if (norm === "shipped" || norm === "partially_fulfilled") {
    return { variant: "blue", label: norm === "shipped" ? "Shipped" : "Partially Fulfilled" };
  }
  if (norm === "confirmed" || norm === "processing" || norm === "ready_to_ship") {
    return {
      variant: "amber",
      label: norm === "processing" ? "Processing" : norm === "ready_to_ship" ? "Ready to Ship" : "Confirmed",
    };
  }
  if (norm === "cancelled" || norm === "canceled" || norm === "failed") {
    return { variant: "rose", label: "Cancelled" };
  }

  // 2. Catalog Products
  if (norm === "active") {
    return { variant: "emerald", label: "Active" };
  }
  if (norm === "pending_review" || norm === "under_review" || norm === "pending") {
    return { variant: "amber", label: "Pending Review" };
  }
  if (norm === "draft") {
    return { variant: "slate", label: "Draft" };
  }
  if (norm === "rejected" || norm === "changes_requested") {
    return {
      variant: "rose",
      label: norm === "changes_requested" ? "Changes Requested" : "Rejected",
    };
  }
  if (norm === "inactive" || norm === "archived") {
    return { variant: "slate", label: "Inactive" };
  }

  // 3. Inventory Stock Health
  if (norm === "healthy" || norm === "in_stock") {
    return { variant: "emerald", label: "Healthy" };
  }
  if (norm === "low_stock" || norm === "low") {
    return { variant: "amber", label: "Low Stock" };
  }
  if (norm === "out_of_stock" || norm === "out") {
    return { variant: "rose", label: "Out of Stock" };
  }
  if (norm === "reserved") {
    return { variant: "blue", label: "Reserved" };
  }

  // 4. Logistics Shipments
  if (norm === "created") {
    return { variant: "slate", label: "Created" };
  }
  if (norm === "booking_pending") {
    return { variant: "amber", label: "Booking Pending" };
  }
  if (norm === "booked" || norm === "awb_assigned") {
    return { variant: "blue", label: norm === "booked" ? "Booked" : "AWB Assigned" };
  }
  if (norm === "booking_failed") {
    return { variant: "rose", label: "Booking Failed" };
  }
  if (norm === "pickup_scheduled" || norm === "pickup_pending") {
    return { variant: "amber", label: norm === "pickup_scheduled" ? "Pickup Scheduled" : "Pickup Pending" };
  }
  if (norm === "manifested" || norm === "in_transit") {
    return { variant: "blue", label: norm === "manifested" ? "Manifested" : "In Transit" };
  }
  if (norm === "out_for_delivery") {
    return { variant: "purple", label: "Out for Delivery" };
  }
  if (norm === "returned" || norm === "delivery_failed" || norm === "rto_initiated" || norm === "rto_in_transit" || norm === "rto_delivered") {
    return { variant: "rose", label: norm === "returned" ? "Returned" : norm.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
  }

  // 5. Customer Returns & RMA
  if (norm === "requested") {
    return { variant: "amber", label: "Pending Inspection" };
  }
  if (norm === "approved") {
    return { variant: "emerald", label: "Approved" };
  }
  if (norm === "inspected") {
    return { variant: "blue", label: "Inspected" };
  }
  if (norm === "refunded" || norm === "completed") {
    return { variant: "emerald", label: "Completed" };
  }

  // 6. Settlements & Withdrawals
  if (norm === "paid" || norm === "settled" || norm === "disbursed") {
    return { variant: "emerald", label: "Disbursed" };
  }

  // Fallback: capitalize underscore-separated strings
  const fallbackLabel = norm
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return { variant: "slate", label: fallbackLabel };
}

