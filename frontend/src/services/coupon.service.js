import apiClient from "../lib/api/axios.js";

/**
 * Coupon Service
 *
 * Backend route mount: /api/v1/coupons
 */
export const couponService = {
  /**
   * Validate a coupon code against an order/cart total
   * @param {Object} payload
   * @param {string} payload.code
   * @param {string} [payload.customerId]
   * @param {number} payload.orderAmount
   * @param {Array} [payload.items]
   * @returns {Promise<Object>} { data: { coupon, discountAmount } }
   */
  async validateCoupon({ code, customerId, orderAmount, items = [] }) {
    const payload = {
      code,
      orderAmount,
      items,
    };
    if (customerId) {
      payload.customerId = customerId;
    }
    return apiClient.post("/coupons/validate", payload);
  },

  /**
   * List coupons (Admin/Staff with coupons:read)
   * @param {Object} [params]
   * @returns {Promise<Object>}
   */
  async getCoupons(params = {}) {
    return apiClient.get("/coupons", { params });
  },

  /**
   * Get coupon by ID
   * @param {string} couponId
   * @returns {Promise<Object>}
   */
  async getCouponById(couponId) {
    return apiClient.get(`/coupons/${couponId}`);
  },

  /**
   * Create coupon (coupons:manage)
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createCoupon(data) {
    return apiClient.post("/coupons", data);
  },

  /**
   * Update coupon (coupons:manage)
   * @param {string} couponId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateCoupon(couponId, data) {
    return apiClient.patch(`/coupons/${couponId}`, data);
  },

  /**
   * Activate coupon
   * @param {string} couponId
   * @returns {Promise<Object>}
   */
  async activateCoupon(couponId) {
    return apiClient.patch(`/coupons/${couponId}/activate`);
  },

  /**
   * Deactivate coupon
   * @param {string} couponId
   * @returns {Promise<Object>}
   */
  async deactivateCoupon(couponId) {
    return apiClient.patch(`/coupons/${couponId}/deactivate`);
  },
};

export default couponService;
