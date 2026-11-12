import apiClient from "../lib/api/axios.js";

/**
 * Customer Profile Service
 *
 * Backend route mount: /api/v1/customers
 * Strictly requires authentication.
 */
export const customerService = {
  /**
   * Get current authenticated user's customer profile
   * @returns {Promise<Object>} { data: { customer } }
   */
  async getProfile() {
    return apiClient.get("/customers/me");
  },

  /**
   * Create initial customer profile
   * @param {Object} data
   * @param {string} [data.phone]
   * @param {string} [data.dateOfBirth]
   * @param {string} [data.gender]
   * @param {Object} [data.preferences]
   * @returns {Promise<Object>} { data: { customer } }
   */
  async createProfile(data) {
    return apiClient.post("/customers/me", data);
  },

  /**
   * Update existing customer profile
   * @param {Object} data
   * @returns {Promise<Object>} { data: { customer } }
   */
  async updateProfile(data) {
    return apiClient.patch("/customers/me", data);
  },

  /**
   * Permanently delete customer account and eligible personal data
   * @param {Object} payload
   * @param {string} [payload.password]
   * @param {string} [payload.confirmation]
   * @param {string} [payload.reason]
   * @returns {Promise<Object>} { data: { permanentlyDeleted, deletedAt } }
   */
  async deleteAccount(payload = {}) {
    return apiClient.delete("/customers/account", { data: payload });
  },
};

export default customerService;
