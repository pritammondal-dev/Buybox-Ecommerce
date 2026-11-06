import apiClient from "../lib/api/axios.js";

/**
 * Public Storefront Special Event Page Service
 */
export const eventPageService = {
  /**
   * Fetch active published event pages for discovery
   */
  async getActiveEvents() {
    return apiClient.get("/storefront/events/active");
  },

  /**
   * Fetch public special event page by slug
   * Supports ?preview=true&token=... for authorized draft preview
   */
  async getEventBySlug(slug, params = {}) {
    return apiClient.get(`/storefront/events/slug/${encodeURIComponent(slug)}`, { params });
  },
};

export default eventPageService;
