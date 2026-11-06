import apiClient from "../lib/api/axios.js";

export const campaignService = {
  async getActiveCampaigns() {
    return apiClient.get("/campaigns/active");
  },

  async getCampaignBySlug(slug, params = {}) {
    return apiClient.get(`/campaigns/slug/${encodeURIComponent(slug)}`, { params });
  },

  async getActiveCoupons() {
    return apiClient.get("/coupons/active");
  },
};

export default campaignService;
