import apiClient from "../lib/api/axios.js";

/**
 * Inventory Service
 *
 * Backend route mount: /api/v1/inventory
 * All endpoints require authentication and inventory permissions.
 */
export const inventoryService = {
  /**
   * Get inventory record by ID
   * @param {string} id
   * @returns {Promise<Object>} { data: { inventory } }
   */
  async getInventoryById(id) {
    return apiClient.get(`/inventory/${id}`);
  },

  /**
   * Get inventory across warehouses for a product variant
   * @param {string} variantId
   * @returns {Promise<Object>} { data: { inventories } }
   */
  async getInventoryByVariant(variantId) {
    return apiClient.get(`/inventory/variant/${variantId}`);
  },

  /**
   * Get warehouse stock summary
   * @param {string} warehouseId
   * @returns {Promise<Object>} { data: { inventories } }
   */
  async getWarehouseStock(warehouseId) {
    return apiClient.get(`/inventory/warehouse/${warehouseId}`);
  },

  /**
   * Create inventory record for a variant in a warehouse
   * @param {Object} data
   * @param {string} data.productVariantId
   * @param {string} data.warehouseId
   * @param {number} data.onHand
   * @param {number} [data.lowStockThreshold]
   * @returns {Promise<Object>}
   */
  async createInventory(data) {
    return apiClient.post("/inventory", data);
  },

  /**
   * Adjust inventory stock
   * @param {string} id
   * @param {Object} data
   * @param {number} data.quantityDelta
   * @param {string} data.reason
   * @param {string} [data.notes]
   * @returns {Promise<Object>}
   */
  async adjustStock(id, data) {
    return apiClient.patch(`/inventory/${id}/adjust`, data);
  },

  /**
   * Manually reserve stock
   * @param {string} id
   * @param {Object} data
   * @param {number} data.quantity
   * @returns {Promise<Object>}
   */
  async reserveStock(id, data) {
    return apiClient.patch(`/inventory/${id}/reserve`, data);
  },

  /**
   * Manually release reserved stock
   * @param {string} id
   * @param {Object} data
   * @param {number} data.quantity
   * @returns {Promise<Object>}
   */
  async releaseStock(id, data) {
    return apiClient.patch(`/inventory/${id}/release`, data);
  },

  /**
   * Deduct reserved stock
   * @param {string} id
   * @param {Object} data
   * @param {number} data.quantity
   * @returns {Promise<Object>}
   */
  async deductStock(id, data) {
    return apiClient.patch(`/inventory/${id}/deduct`, data);
  },
};

export default inventoryService;
