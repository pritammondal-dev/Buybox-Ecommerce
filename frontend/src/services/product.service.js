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

  /**
   * Upload an image for a product
   * @param {FormData} formData
   * @returns {Promise<Object>}
   */
  async uploadProductImage(formData) {
    return apiClient.post("/products/images/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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
   * Retrieve real-time availability for a variant
   * @param {string} variantId
   * @returns {Promise<Object>} { data: { variantId, sku, availableQuantity, inStock, stockStatus, price } }
   */
  async getVariantAvailability(variantId) {
    return apiClient.get(`/products/variants/${variantId}/availability`);
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
   * Create multiple variants in a batch
   * @param {string} productId
   * @param {Object} data { variants: Array }
   * @returns {Promise<Object>} { data: { count, variants } }
   */
  async createBulkVariants(productId, data) {
    return apiClient.post(`/product-variants/product/${productId}/bulk`, data);
  },

  /**
   * Update multiple variants in a batch
   * @param {string} productId
   * @param {Object} data { updates: Array }
   * @returns {Promise<Object>} { data: { updatedCount, variants } }
   */
  async updateBulkVariants(productId, data) {
    return apiClient.patch(`/product-variants/product/${productId}/bulk`, data);
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

  /**
   * Upload a digital file to secure private storage
   * @param {File} file
   * @param {Object} [metadata]
   * @returns {Promise<Object>}
   */
  async uploadDigitalAsset(file, metadata = {}) {
    const formData = new FormData();
    formData.append("file", file);
    if (metadata.version) {
      formData.append("version", metadata.version);
    }
    return apiClient.post("/products/digital-assets/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /**
   * List customer's digital product entitlements
   * @param {Object} [params]
   * @returns {Promise<Object>}
   */
  async getMyDigitalDownloads(params = {}) {
    return apiClient.get("/digital-downloads/my", { params });
  },

  /**
   * Download digital entitlement asset stream
   * @param {string} entitlementId
   * @returns {Promise<any>}
   */
  async downloadDigitalAsset(entitlementId) {
    return apiClient.get(`/digital-downloads/${entitlementId}`, {
      responseType: "blob",
    });
  },
};

export default productService;
