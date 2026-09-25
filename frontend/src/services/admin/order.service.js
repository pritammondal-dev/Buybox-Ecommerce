import apiClient from "../../lib/api/admin-axios.js";

/**
 * Admin Order Management Service
 *
 * Provides marketplace operations with comprehensive multi-vendor order
 * visibility, customer details, fulfillment status, and returns tracking.
 */
export const adminOrderService = {
  async getOrders(params = {}) {
    const response = await apiClient.get("/orders/admin", { params });
    return response.data?.data ? response.data : { data: response.data || [] };
  },

  async getOrderById(id) {
    const response = await apiClient.get(`/orders/admin/${encodeURIComponent(id)}`);
    return response.data?.data || response.data;
  },

  async cancelOrder(id, reason = "") {
    const response = await apiClient.post(`/orders/admin/${encodeURIComponent(id)}/cancel`, {
      reason,
      cancellationReason: reason,
    });
    return response.data?.data || response.data;
  },

  async getReturns(params = {}) {
    const response = await apiClient.get("/return-requests/admin", { params });
    return response.data?.data ? response.data : { data: response.data || [] };
  },

  async getReturnById(id) {
    const response = await apiClient.get(`/return-requests/admin/${encodeURIComponent(id)}`);
    return response.data?.data || response.data;
  },
};

export default adminOrderService;
