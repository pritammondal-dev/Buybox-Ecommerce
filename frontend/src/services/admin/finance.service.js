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

  // Vendor Withdrawal Request Queue & Processing
  async getWithdrawals(params = {}) {
    const response = await apiClient.get("/finance/withdrawals", { params });
    return response.data?.data ? response.data : { data: response.data || [], meta: response.meta || {} };
  },

  async getWithdrawalById(id) {
    const response = await apiClient.get(`/finance/withdrawals/${encodeURIComponent(id)}`);
    return response.data?.data || response.data;
  },

  async approveWithdrawal(id, data = {}) {
    const response = await apiClient.post(`/finance/withdrawals/${encodeURIComponent(id)}/approve`, data);
    return response.data?.data || response.data;
  },

  async rejectWithdrawal(id, data = {}) {
    const response = await apiClient.post(`/finance/withdrawals/${encodeURIComponent(id)}/reject`, data);
    return response.data?.data || response.data;
  },

  async processWithdrawal(id, data = {}) {
    const response = await apiClient.post(`/finance/withdrawals/${encodeURIComponent(id)}/process`, data);
    return response.data?.data || response.data;
  },

  async markWithdrawalPaid(id, data = {}) {
    const response = await apiClient.post(`/finance/withdrawals/${encodeURIComponent(id)}/mark-paid`, data);
    return response.data?.data || response.data;
  },

  async markWithdrawalFailed(id, data = {}) {
    const response = await apiClient.post(`/finance/withdrawals/${encodeURIComponent(id)}/mark-failed`, data);
    return response.data?.data || response.data;
  },

  // Financial Overview
  async getFinancialOverview(params = {}) {
    const response = await apiClient.get("/finance/overview", { params });
    return response.data?.data || response.data;
  },

  // Commission Policies
  async listCommissionPolicies(params = {}) {
    const response = await apiClient.get("/finance/commission-policies", { params });
    return response.data?.data ? response.data : { data: response.data || [], meta: response.meta || {} };
  },

  async getCommissionPolicyById(id) {
    const response = await apiClient.get(`/finance/commission-policies/${encodeURIComponent(id)}`);
    return response.data?.data || response.data;
  },

  async createCommissionPolicy(data = {}) {
    const response = await apiClient.post("/finance/commission-policies", data);
    return response.data?.data || response.data;
  },

  async updateCommissionPolicy(id, data = {}) {
    const response = await apiClient.put(`/finance/commission-policies/${encodeURIComponent(id)}`, data);
    return response.data?.data || response.data;
  },

  async toggleCommissionPolicyStatus(id, data = {}) {
    const response = await apiClient.patch(`/finance/commission-policies/${encodeURIComponent(id)}/status`, data);
    return response.data?.data || response.data;
  },

  async deleteCommissionPolicy(id, data = {}) {
    const response = await apiClient.delete(`/finance/commission-policies/${encodeURIComponent(id)}`, { data });
    return response.data?.data || response.data;
  },

  async previewCommissionCalculation(data = {}) {
    const response = await apiClient.post("/finance/commission-policies/preview", data);
    return response.data?.data || response.data;
  },

  // Vendor Wallets Oversight
  async listVendorWallets(params = {}) {
    const response = await apiClient.get("/finance/wallets", { params });
    return response.data?.data ? response.data : { data: response.data || [], meta: response.meta || {} };
  },

  async getVendorWalletDrilldown(vendorId, params = {}) {
    const response = await apiClient.get(`/finance/wallets/${encodeURIComponent(vendorId)}/drilldown`, { params });
    return response.data?.data || response.data;
  },

  // Reconciliation & Balanced Corrections
  async getReconciliationSummary(params = {}) {
    const response = await apiClient.get("/finance/reconciliation/summary", { params });
    return response.data?.data || response.data;
  },

  async postReconciliationCorrection(data = {}, headers = {}) {
    const response = await apiClient.post("/finance/reconciliation/adjust", data, { headers });
    return response.data?.data || response.data;
  },

  async syncVendorWalletProjections(vendorId, data = {}) {
    const response = await apiClient.post(`/finance/reconciliation/wallets/${encodeURIComponent(vendorId)}/sync`, data);
    return response.data?.data || response.data;
  },
};

export default adminFinanceService;
