import apiClient from "../lib/api/axios.js";

/**
 * Storefront Presentation & CMS Service
 *
 * Backend route mounts:
 * - /api/v1/storefront/banners
 * - /api/v1/storefront/sections
 * - /api/v1/storefront/announcement-bars
 */
export const storefrontService = {
  /**
   * Fetch active storefront promotional/hero banners
   * @returns {Promise<Object>} { data: Array<{ _id, title, imageUrl, mobileImageUrl, linkUrl, displayOrder }> }
   */
  async getBanners() {
    return apiClient.get("/storefront/banners/active");
  },

  /**
   * Fetch active dynamic storefront homepage sections
   * @returns {Promise<Object>} { data: Array<{ _id, title, key, type, subtitle, productIds, limit }> }
   */
  async getSections() {
    return apiClient.get("/storefront/sections/active");
  },

  /**
   * Fetch all storefront sections for Admin Merchandising
   * @returns {Promise<Object>} { data: Array<StorefrontSection> }
   */
  async getAllSections(params = {}) {
    return apiClient.get("/storefront/sections", { params });
  },

  /**
   * Fetch single section by ID
   */
  async getSectionById(sectionId) {
    return apiClient.get(`/storefront/sections/${sectionId}`);
  },

  /**
   * Create a new custom or system storefront section
   */
  async createSection(data) {
    return apiClient.post("/storefront/sections", data);
  },

  /**
   * Update an existing storefront section
   */
  async updateSection(sectionId, data) {
    return apiClient.patch(`/storefront/sections/${sectionId}`, data);
  },

  /**
   * Delete a custom storefront section (system sections are protected)
   */
  async deleteSection(sectionId) {
    return apiClient.delete(`/storefront/sections/${sectionId}`);
  },

  /**
   * Reorder multiple storefront sections in bulk
   * @param {Array<{ id: string, displayOrder: number, isActive?: boolean }>} sections
   */
  async reorderSections(sections) {
    return apiClient.patch("/storefront/sections/reorder", { sections });
  },

  /**
   * Initialize default system sections if missing
   */
  async initializeDefaults() {
    return apiClient.post("/storefront/sections/initialize-defaults");
  },

  /**
   * Fetch paginated products for a storefront section (View More / Discovery)
   * @param {string} key
   * @param {Object} params { page, limit, groupId, category, brand, minPrice, maxPrice, sortBy, inStockOnly }
   */
  async getSectionProducts(key, params = {}) {
    return apiClient.get(`/storefront/sections/active/${key}/products`, { params });
  },

  /**
   * Fetch paginated products for admin preview
   * @param {string} sectionId
   * @param {Object} params
   */
  async getAdminSectionProducts(sectionId, params = {}) {
    return apiClient.get(`/storefront/sections/${sectionId}/products`, { params });
  },

  /**
   * Fetch active top announcement ticker bars
   * @returns {Promise<Object>} { data: Array<{ _id, text, linkUrl, isActive }> }
   */
  async getAnnouncementBars() {
    return apiClient.get("/storefront/announcement-bars/active");
  },
};

export default storefrontService;
