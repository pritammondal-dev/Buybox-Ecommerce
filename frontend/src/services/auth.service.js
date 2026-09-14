import apiClient from "../lib/api/axios.js";

/**
 * Authentication Service
 *
 * Implements ONLY endpoints that exist in the backend API contract.
 * Backend route mount: /api/v1/auth
 *
 * Security & Token architecture:
 * - Access token (15m) is stored in memory via tokenManager.
 * - Refresh token (7d) is stored in an httpOnly cookie scoped to /api/v1/auth.
 * - Backend also supports fallback { refreshToken } in the request body for non-cookie clients.
 */
export const authService = {
  /**
   * Register a new customer user account
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} payload.password
   * @param {string} payload.firstName
   * @param {string} payload.lastName
   * @returns {Promise<Object>} Backend response with created user
   */
  async register({ email, password, firstName, lastName }) {
    return apiClient.post("/auth/register", {
      email,
      password,
      firstName,
      lastName,
    });
  },

  /**
   * Login with email and password
   * Sets httpOnly refreshToken cookie on response and returns accessToken + user
   * @param {Object} credentials
   * @param {string} credentials.email
   * @param {string} credentials.password
   * @returns {Promise<Object>} Backend response with user and accessToken
   */
  async login({ email, password }) {
    return apiClient.post("/auth/login", {
      email,
      password,
    });
  },

  /**
   * Refresh the short-lived access token
   * Refresh token is sent automatically via httpOnly cookie.
   * Optional manual refreshToken parameter supported for non-cookie environments.
   * @param {string} [refreshToken]
   * @returns {Promise<Object>} Backend response with new accessToken
   */
  async refresh(refreshToken = null) {
    const payload = refreshToken ? { refreshToken } : {};
    return apiClient.post("/auth/refresh", payload);
  },

  /**
   * Logout the current session
   * Revokes the current refresh token session and clears the httpOnly cookie
   * @param {string} [refreshToken]
   * @returns {Promise<Object>} Backend response
   */
  async logout(refreshToken = null) {
    const payload = refreshToken ? { refreshToken } : {};
    return apiClient.post("/auth/logout", payload);
  },

  /**
   * Logout all active sessions across all devices
   * Requires valid access token
   * @returns {Promise<Object>} Backend response with revokedCount
   */
  async logoutAll() {
    return apiClient.post("/auth/logout-all");
  },

  /**
   * Verify customer email address using cryptographic token sent via email
   * @param {string} token
   * @returns {Promise<Object>} Backend response with verified user status
   */
  async verifyEmail(token) {
    return apiClient.get("/auth/verify-email", {
      params: { token },
    });
  },

  /**
   * Request password reset link for registered email
   * @param {Object} payload
   * @param {string} payload.email
   * @returns {Promise<Object>} Backend response
   */
  async requestPasswordReset({ email }) {
    return apiClient.post("/auth/forgot-password", { email });
  },

  /**
   * Execute password reset using the token from reset email
   * @param {Object} payload
   * @param {string} payload.token
   * @param {string} payload.newPassword
   * @returns {Promise<Object>} Backend response
   */
  async resetPassword({ token, newPassword }) {
    return apiClient.post("/auth/reset-password", {
      token,
      newPassword,
    });
  },
};

export default authService;
