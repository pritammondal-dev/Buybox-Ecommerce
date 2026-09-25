import apiClient from "../lib/api/axios.js";

/**
 * Category Service
 *
 * Backend route mount: /api/v1/categories
 */
export const categoryService = {
  /**
   * List all categories (flat or hierarchical)
   * @param {Object} [params]
   * @returns {Promise<Object>} { data: { categories } }
   */
  async getCategories(params = {}) {
    return apiClient.get("/categories", { params });
  },

  /**
   * Get category details by ID
   * @param {string} id
   * @returns {Promise<Object>} { data: { category } }
   */
  async getCategoryById(id) {
    return apiClient.get(`/categories/${id}`);
  },

  /**
   * Create a new category
   * @param {Object} data
   * @param {string} data.name
   * @param {string} data.slug
   * @param {string} [data.parentId]
   * @param {string} [data.description]
   * @param {Object} [data.image]
   * @returns {Promise<Object>}
   */
  async createCategory(data) {
    return apiClient.post("/categories", data);
  },

  /**
   * Update category
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateCategory(id, data) {
    return apiClient.patch(`/categories/${id}`, data);
  },

  /**
   * Delete category
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deleteCategory(id) {
    return apiClient.delete(`/categories/${id}`);
  },

  /**
   * Get dynamic attributes attached to a category
   * @param {string} categoryId
   * @returns {Promise<Object>}
   */
  async getCategoryAttributes(categoryId) {
    return apiClient.get(`/categories/${categoryId}/attributes`);
  },
};

export default categoryService;
