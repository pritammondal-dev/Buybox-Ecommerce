import apiClient from "../lib/api/axios.js";

/**
 * Payment & Refund Service
 *
 * Backend route mount: /api/v1/payments
 * Note: Gateway credentials (keyId) come from the backend response, never hardcoded.
 */
export const paymentService = {
  /**
   * Create Razorpay payment intent for an order
   * @param {string} orderId - MongoDB ObjectId
   * @param {string} [idempotencyKey] - Optional idempotency key
   * @returns {Promise<Object>} { data: payment }
   */
  async createPaymentIntent(orderId, idempotencyKey = null) {
    const config = {};
    if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim().length >= 8) {
      config.headers = { "Idempotency-Key": idempotencyKey.trim() };
    }
    return apiClient.post(`/payments/orders/${orderId}`, {}, config);
  },

  /**
   * Verify Razorpay payment signature
   * @param {Object} payload
   * @param {string} payload.orderId
   * @param {string} payload.razorpayOrderId
   * @param {string} payload.razorpayPaymentId
   * @param {string} payload.razorpaySignature
   * @returns {Promise<Object>} { data: { order } }
   */
  async verifyPaymentSignature({
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  }) {
    return apiClient.post("/payments/verify", {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
  },

  /**
   * Capture authorized payment manually (Fallback/Admin)
   * @param {string} orderId
   * @returns {Promise<Object>}
   */
  async capturePayment(orderId) {
    return apiClient.post(`/payments/orders/${orderId}/capture`);
  },

  /**
   * Create refund for an order (Requires payments:manage)
   * @param {string} orderId
   * @param {Object} payload
   * @param {number} payload.amount
   * @param {string} payload.reason
   * @param {string} [payload.notes]
   * @returns {Promise<Object>}
   */
  async createRefund(orderId, payload) {
    return apiClient.post(`/payments/orders/${orderId}/refunds`, payload);
  },
};

export default paymentService;
