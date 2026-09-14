import apiClient from "../lib/api/axios.js";

/**
 * Authenticated Cart Service
 *
 * Backend route mount: /api/v1/cart
 * Note: All backend cart endpoints strictly require authentication.
 * For unauthenticated users, the frontend manages a separate guest cart via Zustand.
 */
export const cartService = {
  /**
   * Fetch current authenticated customer's cart
   * @returns {Promise<Object>} { data: { cart } }
   */
  async getCart() {
    return apiClient.get("/cart");
  },

  /**
   * Add a product variant item to the cart
   * @param {Object} payload
   * @param {string} [payload.productVariantId] - MongoDB ObjectId
   * @param {string} [payload.productId] - MongoDB ObjectId (resolved by backend if only 1 variant)
   * @param {number} [payload.quantity=1] - Positive integer (1-99)
   * @returns {Promise<Object>} { data: { cart } }
   */
  async addItem({ productVariantId, productId, quantity = 1 }) {
    const payload = { quantity };
    if (productVariantId) payload.productVariantId = productVariantId;
    if (productId) payload.productId = productId;
    return apiClient.post("/cart/items", payload);
  },

  /**
   * Update quantity of an existing item in the cart
   * @param {Object} payload
   * @param {string} payload.productVariantId - MongoDB ObjectId
   * @param {number} payload.quantity - Positive integer (1-99)
   * @returns {Promise<Object>} { data: { cart } }
   */
  async updateItemQuantity({ productVariantId, quantity }) {
    return apiClient.patch("/cart/items", {
      productVariantId,
      quantity,
    });
  },

  /**
   * Remove an item from the cart
   * @param {Object} payload
   * @param {string} payload.productVariantId - MongoDB ObjectId
   * @returns {Promise<Object>} { data: { cart } }
   */
  async removeItem({ productVariantId }) {
    return apiClient.delete("/cart/items", {
      data: { productVariantId },
    });
  },

  /**
   * Clear the entire authenticated cart
   * @returns {Promise<Object>}
   */
  async clearCart() {
    return apiClient.delete("/cart");
  },

  /**
   * Recover an abandoned cart
   * @returns {Promise<Object>} { data: { cart } }
   */
  async recoverCart() {
    return apiClient.post("/cart/recover");
  },
};

export default cartService;
