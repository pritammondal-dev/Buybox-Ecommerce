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
   * Create an order from current cart (Finalize Checkout)
   * Triggers stock reservation, tax calculation, multi-warehouse allocation.
   * @param {Object} payload
   * @param {string} payload.shippingAddressId - MongoDB ObjectId
   * @param {string} [payload.couponCode] - Optional promo code
   * @param {string} [payload.idempotencyKey] - Optional idempotency key (min 8 chars)
   * @returns {Promise<Object>} { data: { order } }
   */
  async createOrder({ shippingAddressId, couponCode = null, idempotencyKey = null }) {
    const body = { shippingAddressId };
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
   * Cancel an order
   * @param {string} id
   * @returns {Promise<Object>} { data: { order } }
   */
  async cancelOrder(id) {
    return apiClient.post(`/orders/${id}/cancel`);
  },
};

export default orderService;
