/**
 * Checkout Steps Constants
 * Defines the canonical checkout stages for Buybox Storefront
 */
export const CHECKOUT_STEPS = [
  { id: 1, key: "address", label: "Delivery Address" },
  { id: 2, key: "delivery", label: "Delivery Options" },
  { id: 3, key: "coupon", label: "Offers / Coupon" },
  { id: 4, key: "payment", label: "Payment" },
  { id: 5, key: "review", label: "Order Review" },
];

export const MARKETPLACE_CHECKOUT_STEPS = [
  { id: 1, key: "address", label: "Address", path: "/checkout/address" },
  { id: 2, key: "summary", label: "Order Summary", path: "/checkout/summary" },
  { id: 3, key: "payment", label: "Payment", path: "/checkout/payment" },
];

export default CHECKOUT_STEPS;
