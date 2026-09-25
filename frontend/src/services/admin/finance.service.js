import apiClient from "../../lib/api/admin-axios.js";

/**
 * Admin Finance & Settlements Service
 *
 * Provides marketplace finance teams with settlement oversight, batch generation,
 * payment recording, and commission reconciliation.
 */
export const adminFinanceService = {
  async getSettlements(params = {}) {
    const response = await apiClient.get("/vendor-settlements/admin", { params });
    return response.data?.data ? response.data : { data: response.data || [] };
  },

  async getSettlementById(id) {
    const response = await apiClient.get(`/vendor-settlements/admin/${encodeURIComponent(id)}`);
    return response.data?.data || response.data;
  },

  async generateSettlements(data = {}) {
    const response = await apiClient.post("/vendor-settlements/generate", data);
    return response.data?.data || response.data;
  },

  async markSettlementPaid(id, data = {}) {
    const response = await apiClient.post(`/vendor-settlements/${encodeURIComponent(id)}/pay`, data);
    return response.data?.data || response.data;
  },
};

export default adminFinanceService;
