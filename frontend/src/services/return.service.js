import apiClient from "../lib/api/axios.js";

export const returnService = {
  async checkEligibility(orderId) {
    return apiClient.get(`/returns/eligibility/${orderId}`);
  },

  async previewRefund(data) {
    return apiClient.post("/returns/preview", data);
  },

  async uploadEvidence(formData) {
    return apiClient.post("/returns/upload-evidence", formData);
  },

  async createReturnRequest(data) {
    return apiClient.post("/returns", data);
  },

  async getMyReturns() {
    return apiClient.get("/returns/my");
  },

  async getReturnsByOrderId(orderId) {
    return apiClient.get(`/returns/order/${orderId}`);
  },

  async getReturnById(returnId) {
    return apiClient.get(`/returns/${returnId}`);
  },

  async cancelReturnRequest(returnId, data = {}) {
    return apiClient.post(`/returns/${returnId}/cancel`, data);
  },

  async cancelReturn(returnId, data = {}) {
    return this.cancelReturnRequest(returnId, data);
  },
};

export default returnService;
