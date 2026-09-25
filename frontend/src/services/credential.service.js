import apiClient from "../lib/api/axios.js";

/**
 * Superadmin Platform Credential Management Service
 * Backend route mount: /api/v1/admin/settings/credentials
 */
export const credentialService = {
  /**
   * List all platform credentials with masked values
   * @returns {Promise<Object>} Masked credentials array
   */
  async listCredentials() {
    return apiClient.get("/admin/settings/credentials");
  },

  /**
   * Update encrypted platform credentials for a provider
   * @param {string} provider Provider slug (elastic_email, delhivery, shiprocket, razorpay, paypal)
   * @param {Object} payload Credential fields
   * @returns {Promise<Object>} Updated masked record
   */
  async updateCredentials(provider, payload) {
    return apiClient.put(`/admin/settings/credentials/${provider}`, payload);
  },

  /**
   * Test live connectivity/sending with provider
   * @param {string} provider
   * @param {Object} [payload] Optional recipientEmail
   * @returns {Promise<Object>} Test outcome
   */
  async testCredential(provider, payload = {}) {
    return apiClient.post(`/admin/settings/credentials/${provider}/test`, payload);
  },
};

export default credentialService;
