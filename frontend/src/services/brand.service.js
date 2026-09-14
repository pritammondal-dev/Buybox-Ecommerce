import apiClient from "../lib/api/axios.js";

/**
 * Brand Service
 *
 * Backend route mount: /api/v1/brands
 */
export const brandService = {
  /**
   * List all brands
   * @param {Object} [params]
   * @returns {Promise<Object>} { data: { brands } }
   */
  async getBrands(params = {}) {
    return apiClient.get("/brands", { params });
  },

  /**
   * Get brand details by ID
   * @param {string} id
   * @returns {Promise<Object>} { data: { brand } }
   */
  async getBrandById(id) {
    return apiClient.get(`/brands/${id}`);
  },

  /**
   * Create a new brand
   * @param {Object} data
   * @param {string} data.name
   * @param {string} data.slug
   * @param {Object} [data.logo]
   * @param {string} [data.website]
   * @returns {Promise<Object>}
   */
  async createBrand(data) {
    return apiClient.post("/brands", data);
  },

  /**
   * Update brand
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateBrand(id, data) {
    return apiClient.patch(`/brands/${id}`, data);
  },

  /**
   * Delete brand
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deleteBrand(id) {
    return apiClient.delete(`/brands/${id}`);
  },
};

export default brandService;
