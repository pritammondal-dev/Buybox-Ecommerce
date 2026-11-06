import apiClient from "../lib/api/axios.js";

const unwrapData = (response) => {
  if (!response) return {};
  let payload = response.data !== undefined ? response.data : response;
  if (payload?.data !== undefined) {
    payload = payload.data;
  }
  return payload || {};
};

/**
 * Public & Vendor Partner Bank Directory Service
 */
export const partnerBankService = {
  /**
   * Search and autocomplete eligible partner banks
   */
  async searchPartnerBanks(params = {}) {
    const query = {
      isActive: "true",
      isEligibleForNewApplications: "true",
      limit: 50,
      ...params,
    };
    const response = await apiClient.get("/partner-banks", { params: query });
    return unwrapData(response);
  },

  /**
   * Get single partner bank by ID
   */
  async getPartnerBank(id) {
    const response = await apiClient.get(`/partner-banks/${encodeURIComponent(id)}`);
    return unwrapData(response);
  },
};

export default partnerBankService;

