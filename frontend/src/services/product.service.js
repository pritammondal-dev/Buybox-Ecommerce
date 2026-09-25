import apiClient from "../lib/api/axios.js";

/**
 * Product & Product Variant Service
 *
 * Backend route mounts:
 * - /api/v1/products
 * - /api/v1/product-variants
 */
export const productService = {
  /**
   * List products with pagination, search, and category/brand filters
   * @param {Object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string} [params.search]
   * @param {string} [params.categoryId]
   * @param {string} [params.brandId]
   * @param {number} [params.minPrice]
   * @param {number} [params.maxPrice]
   * @param {string} [params.sort]
   * @param {string} [params.status]
   * @returns {Promise<Object>} { data: { products }, meta: { page, limit, total, totalPages } }
   */
  async getProducts(params = {}) {
    return apiClient.get("/products", { params });
  },

  /**
   * Retrieve product details by URL slug
   * @param {string} slug
   * @returns {Promise<Object>} { data: { product } }
   */
  async getProductBySlug(slug) {
    return apiClient.get(`/products/slug/${encodeURIComponent(slug)}`);
  },

  /**
   * Retrieve product by MongoDB ObjectId
   * @param {string} id
   * @returns {Promise<Object>} { data: { product } }
   */
  async getProductById(id) {
    return apiClient.get(`/products/${id}`);
  },

  /**
   * Create a new product (Admin/Vendor)
   * @param {Object} data
   * @returns {Promise<Object>} Created product
   */
  async createProduct(data) {
    return apiClient.post("/products", data);
  },

  /**
   * Update an existing product
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>} Updated product
   */
  async updateProduct(id, data) {
    return apiClient.patch(`/products/${id}`, data);
  },

  /**
   * Delete a product
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deleteProduct(id) {
    return apiClient.delete(`/products/${id}`);
  },

  // -------------------------------------------------------------
  // Product Variants
  // -------------------------------------------------------------

  /**
   * List variants for a specific product
   * @param {string} productId
   * @returns {Promise<Object>} { data: { variants } }
   */
  async getVariantsByProductId(productId) {
    return apiClient.get(`/product-variants/product/${productId}`);
  },

  /**
   * Get single variant by ID
   * @param {string} id
   * @returns {Promise<Object>} { data: { variant } }
   */
  async getVariantById(id) {
    return apiClient.get(`/product-variants/${id}`);
  },

  /**
   * Create a variant for a product
   * @param {string} productId
   * @param {Object} data
   * @returns {Promise<Object>} Created variant
   */
  async createVariant(productId, data) {
    return apiClient.post(`/product-variants/product/${productId}`, data);
  },

  /**
   * Update a product variant
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>} Updated variant
   */
  async updateVariant(id, data) {
    return apiClient.patch(`/product-variants/${id}`, data);
  },

  /**
   * Delete a product variant
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deleteVariant(id) {
    return apiClient.delete(`/product-variants/${id}`);
  },

  /**
   * Retrieve related products
   * @param {string} id
   * @param {number} [limit=6]
   * @returns {Promise<Object>}
   */
  async getRelatedProducts(id, limit = 6) {
    return apiClient.get(`/products/${id}/related`, { params: { limit } });
  },

  /**
   * Retrieve recommended products
   * @param {Object} [params]
   * @returns {Promise<Object>}
   */
  async getRecommendations(params = {}) {
    return apiClient.get("/products/recommendations", { params });
  },
};

export default productService;
