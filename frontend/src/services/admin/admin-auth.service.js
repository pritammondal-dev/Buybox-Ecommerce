import adminApiClient from "../../lib/api/admin-axios.js";

/**
 * Dedicated Administrator Authentication Service
 *
 * Communicates strictly with `/api/v1/administrator/auth/*` endpoints.
 * Operates independently from customer and vendor authentication boundaries.
 */
export const adminAuthService = {
  /**
   * Authenticate employee credentials
   * Sets httpOnly bb_administrator_session cookie and returns accessToken + user
   * @param {Object} credentials
   * @param {string} credentials.email
   * @param {string} credentials.password
   * @returns {Promise<Object>}
   */
  async login({ email, password }) {
    return adminApiClient.post("/administrator/auth/login", {
      email,
      password,
    });
  },

  /**
   * Refresh the short-lived administrator access token
   * @returns {Promise<Object>}
   */
  async refresh() {
    return adminApiClient.post("/administrator/auth/refresh");
  },

  /**
   * Fetch current authenticated employee identity and permissions
   * @returns {Promise<Object>}
   */
  async getMe() {
    return adminApiClient.get("/administrator/auth/me");
  },

  /**
   * Logout current administrator session
   * Revokes refresh token and clears bb_administrator_session cookie
   * @returns {Promise<Object>}
   */
  async logout() {
    return adminApiClient.post("/administrator/auth/logout");
  },
};

export default adminAuthService;
