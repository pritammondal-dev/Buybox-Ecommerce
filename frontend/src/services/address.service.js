import apiClient from "../lib/api/axios.js";

/**
 * Address Service
 *
 * Backend route mount: /api/v1/addresses
 * Strictly requires authentication.
 */
export const addressService = {
  /**
   * Get all saved addresses for the authenticated customer
   * @returns {Promise<Object>} { data: { addresses } }
   */
  async getAddresses() {
    return apiClient.get("/addresses");
  },

  /**
   * Get a single address by ID
   * @param {string} id
   * @returns {Promise<Object>} { data: { address } }
   */
  async getAddressById(id) {
    return apiClient.get(`/addresses/${id}`);
  },

  /**
   * Create a new address
   * @param {Object} data
   * @param {string} data.firstName
   * @param {string} data.lastName
   * @param {string} data.phone
   * @param {string} data.addressLine1
   * @param {string} [data.addressLine2]
   * @param {string} data.city
   * @param {string} data.state
   * @param {string} data.postalCode
   * @param {string} [data.country="IN"]
   * @param {string} [data.type="home"]
   * @param {boolean} [data.isDefault=false]
   * @returns {Promise<Object>} { data: { address } }
   */
  async createAddress(data) {
    return apiClient.post("/addresses", data);
  },

  /**
   * Update an address
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>} { data: { address } }
   */
  async updateAddress(id, data) {
    return apiClient.patch(`/addresses/${id}`, data);
  },

  /**
   * Delete an address
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deleteAddress(id) {
    return apiClient.delete(`/addresses/${id}`);
  },
};

export default addressService;
