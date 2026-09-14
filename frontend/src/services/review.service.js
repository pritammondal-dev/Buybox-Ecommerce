import apiClient from "../lib/api/axios.js";

/**
 * Review Service
 *
 * Backend route mount: /api/v1/reviews
 */
export const reviewService = {
  /**
   * Get public reviews for a product with pagination
   * @param {string} productId
   * @param {Object} [params]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   * @returns {Promise<Object>} { data: { reviews }, meta: { ... } }
   */
  async getProductReviews(productId, params = {}) {
    return apiClient.get(`/reviews/product/${productId}`, { params });
  },

  /**
   * Get single review by reviewId
   * @param {string} reviewId
   * @returns {Promise<Object>} { data: { review } }
   */
  async getReviewById(reviewId) {
    return apiClient.get(`/reviews/${reviewId}`);
  },

  /**
   * Submit a product review (Requires authenticated customer with delivered order)
   * @param {Object} payload
   * @param {string} payload.productId - 24-hex ObjectId (Required)
   * @param {string} payload.orderId - 24-hex ObjectId of delivered order (Required)
   * @param {number} payload.rating - Integer 1 to 5 (Required)
   * @param {string} [payload.title] - Review headline, max 150 chars
   * @param {string} [payload.comment] - Detailed review text, max 2000 chars
   * @param {string} [payload.productVariantId] - Optional variant ObjectId
   * @returns {Promise<Object>} { data: review }
   */
  async createReview(payload) {
    return apiClient.post("/reviews", payload);
  },

  /**
   * Update own review
   * @param {string} reviewId
   * @param {Object} payload
   * @returns {Promise<Object>} { data: { review } }
   */
  async updateReview(reviewId, payload) {
    return apiClient.patch(`/reviews/${reviewId}`, payload);
  },

  /**
   * Mark a review as helpful (Backend contract: POST /api/v1/reviews/:reviewId/helpful)
   * @param {string} reviewId
   * @returns {Promise<Object>}
   */
  async markHelpful(reviewId) {
    return apiClient.post(`/reviews/${reviewId}/helpful`);
  },

  /**
   * Alias for markHelpful aligning with vote action naming
   * @param {string} reviewId
   * @returns {Promise<Object>}
   */
  async voteReview(reviewId) {
    return this.markHelpful(reviewId);
  },

  /**
   * Moderate review (Admin/Staff with reviews:manage)
   * @param {string} reviewId
   * @param {Object} payload
   * @param {string} payload.status - "approved" | "rejected"
   * @returns {Promise<Object>}
   */
  async moderateReview(reviewId, payload) {
    return apiClient.patch(`/reviews/${reviewId}/moderate`, payload);
  },

  /**
   * Add vendor response to a review (reviews:manage)
   * @param {string} reviewId
   * @param {Object} payload
   * @param {string} payload.response
   * @returns {Promise<Object>}
   */
  async addVendorResponse(reviewId, payload) {
    return apiClient.patch(`/reviews/${reviewId}/vendor-response`, payload);
  },
};

export default reviewService;
