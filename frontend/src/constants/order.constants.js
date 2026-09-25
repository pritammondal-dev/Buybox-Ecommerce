/**
 * Order Domain Constants & Utilities
 *
 * Provides shared order statuses, cancellation rules, delivery estimate hierarchy,
 * and timeline stages for both UI components and Node.js unit tests.
 */

import { parsePrice } from "../utils/formatCurrency.js";

/**
 * Sequential stages in the standard order fulfillment timeline.
 * Directly maps to backend Order.status.
 */
export const ORDER_TIMELINE_STAGES = [
  {
    key: "pending",
    label: "Order Placed",
    description: "Order received and inventory reserved.",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    description: "Payment and details verified by warehouse.",
  },
  {
    key: "processing",
    label: "Processing",
    description: "Items picked and packed for shipment.",
  },
  {
    key: "shipped",
    label: "Shipped",
    description: "Handed over to logistics carrier.",
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Package successfully delivered.",
  },
];

/**
 * Statuses where an order can be cancelled by the customer.
 * Enforced by backend orderService.cancelOrder.
 */
export const CANCELLABLE_ORDER_STATUSES = ["pending", "confirmed", "processing"];

/**
 * Check whether an order is eligible for customer cancellation.
 * @param {Object} order
 * @returns {boolean}
 */
export function isOrderCancellable(order) {
  if (!order || !order.status) return false;
  const status = String(order.status).toLowerCase();
  return CANCELLABLE_ORDER_STATUSES.includes(status);
}

/**
 * Get current step index in the 5-stage timeline.
 * Returns -1 if cancelled or unrecognized.
 * @param {string} status
 * @returns {number} 0-indexed stage number
 */
export function getTimelineStepIndex(status) {
  const norm = String(status || "").toLowerCase();
  if (norm === "completed") return 4;
  return ORDER_TIMELINE_STAGES.findIndex((stage) => stage.key === norm);
}

/**
 * Resolves the delivery estimate according to strict priority:
 * 1. Actual order/shipment delivery estimate from the backend, if available.
 * 2. Actual shipment/carrier tracking data from backend, if available.
 * 3. A clearly labeled generic policy estimate only if the backend provides no order-specific estimate.
 *
 * Never presents a generic policy estimate as though it were an order-specific delivery commitment.
 *
 * @param {Object} params
 * @param {Object} [params.order]
 * @param {Object} [params.shipment]
 * @param {Object} [params.policy]
 * @returns {Object} { type, formatted, label, source, isGenericPolicy }
 */
export function getOrderDeliveryEstimate({ order, shipment, policy = null } = {}) {
  // Priority 1: Actual order/shipment delivery estimate from the backend
  const backendDate =
    order?.estimatedDeliveryDate ||
    shipment?.estimatedDeliveryDate ||
    order?.estimatedDelivery;

  if (backendDate) {
    const d = new Date(backendDate);
    if (!isNaN(d.getTime())) {
      return {
        type: "order_specific",
        date: d,
        formatted: d.toLocaleDateString("en-IN", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        label: "Estimated Delivery",
        source: "backend_order",
        isGenericPolicy: false,
      };
    }
  }

  // Priority 2: Actual shipment/carrier tracking data from backend
  if (shipment) {
    if (shipment.status === "out_for_delivery") {
      return {
        type: "carrier_tracking",
        formatted: "Out for delivery today",
        label: "Shipment Status",
        source: "carrier_realtime",
        isGenericPolicy: false,
      };
    }
    if (shipment.status === "in_transit") {
      return {
        type: "carrier_tracking",
        formatted: shipment.carrier
          ? `In transit via ${shipment.carrier} (${shipment.trackingNumber || "Active"})`
          : "In transit with courier partner",
        label: "Shipment Status",
        source: "carrier_realtime",
        isGenericPolicy: false,
      };
    }
    if (shipment.status === "delivered") {
      const deliveredDate = shipment.deliveredAt ? new Date(shipment.deliveredAt) : null;
      return {
        type: "carrier_tracking",
        formatted:
          deliveredDate && !isNaN(deliveredDate.getTime())
            ? `Delivered on ${deliveredDate.toLocaleDateString("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}`
            : "Package Delivered",
        label: "Delivery Confirmation",
        source: "carrier_realtime",
        isGenericPolicy: false,
      };
    }
  }

  // Priority 3: Clearly labeled generic policy estimate only if backend provides no order-specific estimate
  const standardEstimate = policy?.shipping?.standard?.estimate || "3–5 business days";
  return {
    type: "generic_policy",
    formatted: `Standard Policy Estimate: Typically ${standardEstimate} from dispatch (actual date will be confirmed once shipped)`,
    label: "Delivery Estimate Policy",
    source: "generic_storefront_policy",
    isGenericPolicy: true,
  };
}

/**
 * Safely extracts historical order financials without recalculating from catalog.
 * @param {Object} order
 * @returns {Object}
 */
export function extractOrderFinancials(order) {
  if (!order) {
    return {
      subtotal: 0,
      discountTotal: 0,
      couponCode: null,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      currency: "INR",
    };
  }

  return {
    subtotal: parsePrice(order.subtotal),
    discountTotal: parsePrice(order.discountTotal),
    couponCode: order.couponCode || null,
    shippingTotal: parsePrice(order.shippingTotal),
    taxTotal: parsePrice(order.taxTotal),
    grandTotal: parsePrice(order.grandTotal),
    currency: order.currency || "INR",
  };
}
