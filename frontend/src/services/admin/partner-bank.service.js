import apiClient from "../../lib/api/admin-axios.js";

const unwrapData = (response) => {
  if (!response) return {};
  let payload = response.data !== undefined ? response.data : response;
  if (payload?.data !== undefined) {
    payload = payload.data;
  }
  return payload || {};
};

/**
 * Superadmin Partner Bank Directory Service
 */
export const adminPartnerBankService = {
  /**
   * List partner banks with search, filters, pagination
   */
  async listPartnerBanks(params = {}) {
    const response = await apiClient.get("/admin/partner-banks", { params });
    return unwrapData(response);
  },

  /**
   * Get single partner bank details
   */
  async getPartnerBank(id) {
    const response = await apiClient.get(`/admin/partner-banks/${encodeURIComponent(id)}`);
    return unwrapData(response);
  },

  /**
   * Register a new partner bank
   */
  async createPartnerBank(data) {
    const response = await apiClient.post("/admin/partner-banks", data);
    return unwrapData(response);
  },

  /**
   * Update partner bank metadata
   */
  async updatePartnerBank(id, data) {
    const response = await apiClient.patch(
      `/admin/partner-banks/${encodeURIComponent(id)}`,
      data
    );
    return unwrapData(response);
  },

  /**
   * Toggle active or application-eligibility status
   */
  async togglePartnerBankStatus(id, { isActive, isEligibleForNewApplications, reason }) {
    const response = await apiClient.patch(
      `/admin/partner-banks/${encodeURIComponent(id)}/status`,
      { isActive, isEligibleForNewApplications, reason }
    );
    return unwrapData(response);
  },
};

export default adminPartnerBankService;

