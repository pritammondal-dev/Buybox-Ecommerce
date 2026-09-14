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
   * Fetch active top announcement ticker bars
   * @returns {Promise<Object>} { data: Array<{ _id, text, linkUrl, isActive }> }
   */
  async getAnnouncementBars() {
    return apiClient.get("/storefront/announcement-bars/active");
  },
};

export default storefrontService;
