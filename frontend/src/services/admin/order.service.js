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

  async updateOrderStatus(id, data = {}) {
    const response = await apiClient.patch(`/orders/admin/${encodeURIComponent(id)}/status`, data);
    return response.data?.data || response.data;
  },

  async overrideFulfillment(id, data = {}) {
    const response = await apiClient.patch(`/orders/admin/${encodeURIComponent(id)}/override-fulfillment`, data);
    return response.data?.data || response.data;
  },

  async updateShipmentStatus(shipmentId, data = {}) {
    const response = await apiClient.patch(`/shipments/${encodeURIComponent(shipmentId)}/status`, data);
    return response.data?.data || response.data;
  },

  async getReturns(params = {}) {
    try {
      const response = await apiClient.get("/returns/admin", { params });
      return response.data?.data ? response.data : (response?.data || response);
    } catch {
      const response = await apiClient.get("/return-requests/admin", { params });
      return response.data?.data ? response.data : (response?.data || response);
    }
  },

  async getReturnById(id) {
    try {
      const response = await apiClient.get(`/returns/admin/${encodeURIComponent(id)}`);
      return response.data?.data || response.data || response;
    } catch {
      const response = await apiClient.get(`/return-requests/admin/${encodeURIComponent(id)}`);
      return response.data?.data || response.data || response;
    }
  },

  async getPackingSlip(id, params = {}) {
    const response = await apiClient.get(`/orders/${encodeURIComponent(id)}/packing-slip`, { params });
    return response.data?.data || response.data;
  },

  async exportOrders(params = {}, format = "csv") {
    return apiClient.get("/orders/export", {
      params: { ...params, format },
      responseType: "blob",
    });
  },

  async exportOrderItems(params = {}, format = "csv") {
    return apiClient.get("/orders/export/items", {
      params: { ...params, format },
      responseType: "blob",
    });
  },

  // Fulfillment Exceptions Queue
  async getFulfillmentExceptions(params = {}) {
    const response = await apiClient.get("/fulfillment-exceptions/admin", { params });
    return response.data?.data ? response.data : { data: response.data || [] };
  },

  async getFulfillmentExceptionById(id) {
    const response = await apiClient.get(`/fulfillment-exceptions/admin/${encodeURIComponent(id)}`);
    return response.data?.data || response.data;
  },

  async transitionFulfillmentException(id, data) {
    const response = await apiClient.post(`/fulfillment-exceptions/admin/${encodeURIComponent(id)}/transition`, data);
    return response.data?.data || response.data;
  },

  async approveExceptionCancellation(id, data = {}) {
    const response = await apiClient.post(`/fulfillment-exceptions/admin/${encodeURIComponent(id)}/approve-cancellation`, data);
    return response.data?.data || response.data;
  },

  // Operational Recovery
  async recoverOrderCancellation(id) {
    const response = await apiClient.post(`/orders/admin/${encodeURIComponent(id)}/recover-cancellation`);
    return response.data?.data || response.data;
  },

  async reconcileRefund(id) {
    const response = await apiClient.post(`/orders/admin/refunds/${encodeURIComponent(id)}/reconcile`);
    return response.data?.data || response.data;
  },

  async reconcileOutbox(data = {}) {
    const response = await apiClient.post("/orders/admin/notifications/reconcile-outbox", data);
    return response.data?.data || response.data;
  },
};

export const adminExceptionService = {
  getExceptions: (params) => adminOrderService.getFulfillmentExceptions(params),
  getExceptionById: (id) => adminOrderService.getFulfillmentExceptionById(id),
  transitionException: (id, data) => adminOrderService.transitionFulfillmentException(id, data),
  approveCancellation: (id, data) => adminOrderService.approveExceptionCancellation(id, data),
};

export const orderAdminService = adminOrderService;
export default adminOrderService;
