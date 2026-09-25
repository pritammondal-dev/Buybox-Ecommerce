import apiClient from "../../lib/api/admin-axios.js";

/**
 * Admin Storefront Banner Service
 * Interacts with /api/v1/storefront/banners endpoints.
 */
export const adminBannerService = {
  /**
   * Fetch all banners for admin management
   * @param {Object} params - Query filters (e.g. { slotKey, isActive })
   */
  async listBanners(params = {}) {
    return apiClient.get("/storefront/banners", { params });
  },

  /**
   * Fetch active banners (public storefront endpoint)
   * @param {Object} params - Optional query filter
   */
  async getActiveBanners(params = {}) {
    return apiClient.get("/storefront/banners/active", { params });
  },

  /**
   * Get single banner by ID
   * @param {string} bannerId
   */
  async getBannerById(bannerId) {
    return apiClient.get(`/storefront/banners/${bannerId}`);
  },

  /**
   * Create a new banner slot configuration
   * @param {Object} bannerData
   */
  async createBanner(bannerData) {
    return apiClient.post("/storefront/banners", bannerData);
  },

  /**
   * Update an existing banner slot configuration
   * @param {string} bannerId
   * @param {Object} updateData
   */
  async updateBanner(bannerId, updateData) {
    return apiClient.patch(`/storefront/banners/${bannerId}`, updateData);
  },

  /**
   * Delete / reset a banner slot configuration
   * @param {string} bannerId
   */
  async deleteBanner(bannerId) {
    return apiClient.delete(`/storefront/banners/${bannerId}`);
  },
};

export default adminBannerService;
