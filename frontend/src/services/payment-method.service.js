import apiClient from "../lib/api/axios.js";

/**
 * Payment Method & Gateway Management Service
 * Supports Admin Dashboard and Customer Storefront Checkout
 */
export const paymentMethodService = {
  /**
   * Public / Customer Storefront: Fetch eligible active payment methods
   * @param {Object} [params] - { country, currency, orderAmount, orderId }
   * @returns {Promise<Object>} API response with eligible payment methods array
   */
  async getAvailablePaymentMethods(params = {}) {
    const response = await apiClient.get("/payment-methods/available", { params });
    return response.data;
  },

  /**
   * Admin: List all payment methods with search, status, gateway filters
   * @param {Object} [params] - { search, status, gateway }
   * @returns {Promise<Object>} API response with methods array
   */
  async listAllPaymentMethods(params = {}) {
    const response = await apiClient.get("/payment-methods", { params });
    return response.data;
  },

  /**
   * Admin: Get single payment method by ID
   * @param {string} id - MongoDB ObjectId
   * @returns {Promise<Object>}
   */
  async getPaymentMethodById(id) {
    const response = await apiClient.get(`/payment-methods/${id}`);
    return response.data;
  },

  /**
   * Admin: Create a new custom payment method
   * @param {Object} data - PaymentMethod payload
   * @returns {Promise<Object>}
   */
  async createPaymentMethod(data) {
    const response = await apiClient.post("/payment-methods", data);
    return response.data;
  },

  /**
   * Admin: Update payment method configuration
   * @param {string} id - MongoDB ObjectId
   * @param {Object} data - Partial update payload
   * @returns {Promise<Object>}
   */
  async updatePaymentMethod(id, data) {
    const response = await apiClient.patch(`/payment-methods/${id}`, data);
    return response.data;
  },

  /**
   * Admin: Toggle active/deactivated status
   * @param {string} id - MongoDB ObjectId
   * @returns {Promise<Object>}
   */
  async togglePaymentMethod(id) {
    const response = await apiClient.patch(`/payment-methods/${id}/toggle`);
    return response.data;
  },

  /**
   * Admin: Soft-delete / archive payment method (preserves historical payments)
   * @param {string} id - MongoDB ObjectId
   * @returns {Promise<Object>}
   */
  async deletePaymentMethod(id) {
    const response = await apiClient.delete(`/payment-methods/${id}`);
    return response.data;
  },

  /**
   * Admin: Reorder payment methods display order
   * @param {Array<string>} orderedIds - Array of method IDs in desired sequence
   * @returns {Promise<Object>}
   */
  async reorderPaymentMethods(orderedIds) {
    const response = await apiClient.post("/payment-methods/reorder", { orderedIds });
    return response.data;
  },

  /**
   * Admin: List payment transaction records (historical audit log)
   * @param {Object} [params] - { page, limit, status, gateway }
   * @returns {Promise<Object>}
   */
  async listTransactions(params = {}) {
    const response = await apiClient.get("/payments/admin/transactions", { params });
    return response.data;
  },

  /**
   * Customer / Storefront: Create PayPal order
   * @param {string} orderId - MongoDB ObjectId
   * @param {string} [idempotencyKey]
   * @returns {Promise<Object>}
   */
  async createPayPalOrder(orderId, idempotencyKey = null) {
    const config = {};
    if (idempotencyKey) {
      config.headers = { "Idempotency-Key": idempotencyKey };
    }
    const response = await apiClient.post(`/payments/paypal/orders/${orderId}`, {}, config);
    return response.data;
  },

  /**
   * Customer / Storefront: Server-side capture of approved PayPal order
   * @param {Object} payload - { orderId, paypalOrderId }
   * @returns {Promise<Object>}
   */
  async capturePayPalPayment({ orderId, paypalOrderId }) {
    const response = await apiClient.post("/payments/paypal/capture", {
      orderId,
      paypalOrderId,
    });
    return response.data;
  },

  /**
   * Customer / Storefront: Get customer's saved payment methods
   * @returns {Promise<Object>}
   */
  async getMyPaymentMethods() {
    const response = await apiClient.get("/payment-methods/my");
    return response.data;
  },

  /**
   * Customer / Storefront: Save tokenized payment instrument
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async saveCustomerPaymentMethod(data) {
    const response = await apiClient.post("/payment-methods/my", data);
    return response.data;
  },

  /**
   * Customer / Storefront: Set default payment method
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async setDefaultPaymentMethod(id) {
    const response = await apiClient.patch(`/payment-methods/my/${id}/default`);
    return response.data;
  },

  /**
   * Customer / Storefront: Delete customer payment method
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deleteCustomerPaymentMethod(id) {
    const response = await apiClient.delete(`/payment-methods/my/${id}`);
    return response.data;
  },
};

export default paymentMethodService;
