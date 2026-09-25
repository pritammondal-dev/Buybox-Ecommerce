import apiClient from "../lib/api/axios.js";

/**
 * Order Service
 *
 * Backend route mount: /api/v1/orders
 * Strictly requires authentication.
 */
export const orderService = {
  /**
   * List customer's orders
   * @param {Object} [params]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   * @returns {Promise<Object>} { data: { orders }, meta: { ... } }
   */
  async getMyOrders(params = {}) {
    return apiClient.get("/orders", { params });
  },

  /**
   * Get single order by ID
   * @param {string} id
   * @returns {Promise<Object>} { data: { order } }
   */
  async getOrderById(id) {
    return apiClient.get(`/orders/${id}`);
  },

  /**
   * Calculate authoritative checkout quote from active cart
   * @param {Object} payload
   * @param {string} [payload.shippingAddressId]
   * @param {string} [payload.couponCode]
   * @param {string} [payload.deliveryOptionId]
   * @returns {Promise<Object>} Authoritative quote with subtotal, shipping, tax, totals
   */
  async getCheckoutQuote({ shippingAddressId = null, couponCode = null, deliveryOptionId = "standard" } = {}) {
    return apiClient.post("/orders/quote", {
      shippingAddressId: shippingAddressId || null,
      couponCode: couponCode || null,
      deliveryOptionId: deliveryOptionId || "standard",
    });
  },

  /**
   * Create an order from current cart (Finalize Checkout)
   * Triggers stock reservation, tax calculation, multi-warehouse allocation.
   * @param {Object} payload
   * @param {string} payload.shippingAddressId - MongoDB ObjectId
   * @param {string} [payload.couponCode] - Optional promo code
   * @param {string} [payload.deliveryOptionId] - Optional delivery option ("standard" | "express")
   * @param {string} [payload.idempotencyKey] - Optional idempotency key (min 8 chars)
   * @returns {Promise<Object>} { data: { order } }
   */
  async createOrder({
    shippingAddressId,
    couponCode = null,
    deliveryOptionId = "standard",
    idempotencyKey = null,
  }) {
    const body = {
      shippingAddressId,
      deliveryOptionId: deliveryOptionId || "standard",
    };
    if (couponCode) {
      body.couponCode = couponCode;
    }
    const config = {};
    if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim().length >= 8) {
      config.headers = { "Idempotency-Key": idempotencyKey.trim() };
    }
    return apiClient.post("/orders", body, config);
  },

  /**
   * Get order lifecycle activity timeline and financial details
   * @param {string} id
   * @returns {Promise<Object>} { data: { timeline, paymentAttempts, financialBreakdown } }
   */
  async getOrderActivity(id) {
    return apiClient.get(`/orders/${id}/activity`);
  },

  /**
   * Cancel an order
   * @param {string} id
   * @returns {Promise<Object>} { data: { order } }
   */
  async cancelOrder(id) {
    return apiClient.post(`/orders/${id}/cancel`);
  },
};

export default orderService;

