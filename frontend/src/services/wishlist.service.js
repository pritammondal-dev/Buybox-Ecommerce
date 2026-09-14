import apiClient from "../lib/api/axios.js";

/**
 * Authenticated Wishlist Service
 *
 * Backend route mount: /api/v1/wishlist
 * Strictly requires authentication.
 */
export const wishlistService = {
  /**
   * Get current authenticated user's wishlist
   * @returns {Promise<Object>} { data: { wishlist } }
   */
  async getWishlist() {
    return apiClient.get("/wishlist");
  },

  /**
   * Add a product / variant to wishlist
   * @param {Object} payload
   * @param {string} payload.productId
   * @param {string} [payload.productVariantId]
   * @returns {Promise<Object>} { data: { wishlist } }
   */
  async addItem({ productId, productVariantId = null }) {
    const payload = { productId };
    if (productVariantId) {
      payload.productVariantId = productVariantId;
    }
    return apiClient.post("/wishlist/items", payload);
  },

  /**
   * Remove item from wishlist by wishlist item ID
   * @param {string} itemId
   * @returns {Promise<Object>}
   */
  async removeItem(itemId) {
    return apiClient.delete(`/wishlist/items/${itemId}`);
  },

  /**
   * Clear all items from wishlist
   * @returns {Promise<Object>}
   */
  async clearWishlist() {
    return apiClient.delete("/wishlist");
  },
};

export default wishlistService;
