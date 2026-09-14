import apiClient from "../lib/api/axios.js";

/**
 * CMS Page Service
 *
 * Backend route mount: /api/v1/cms/pages
 */
export const cmsService = {
  /**
   * Get published CMS page by URL slug (Public)
   * @param {string} slug
   * @returns {Promise<Object>} { data: { page } }
   */
  async getPageBySlug(slug) {
    return apiClient.get(`/cms/pages/published/${encodeURIComponent(slug)}`);
  },

  /**
   * List CMS pages (Admin)
   * @param {Object} [params]
   * @returns {Promise<Object>}
   */
  async listPages(params = {}) {
    return apiClient.get("/cms/pages", { params });
  },

  /**
   * Get page by ID (Admin)
   * @param {string} pageId
   * @returns {Promise<Object>}
   */
  async getPageById(pageId) {
    return apiClient.get(`/cms/pages/${pageId}`);
  },

  /**
   * Create page (Admin)
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createPage(data) {
    return apiClient.post("/cms/pages", data);
  },

  /**
   * Update page (Admin)
   * @param {string} pageId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updatePage(pageId, data) {
    return apiClient.patch(`/cms/pages/${pageId}`, data);
  },

  /**
   * Publish page (Admin)
   * @param {string} pageId
   * @returns {Promise<Object>}
   */
  async publishPage(pageId) {
    return apiClient.patch(`/cms/pages/${pageId}/publish`);
  },

  /**
   * Delete page (Admin)
   * @param {string} pageId
   * @returns {Promise<Object>}
   */
  async deletePage(pageId) {
    return apiClient.delete(`/cms/pages/${pageId}`);
  },
};

export default cmsService;
