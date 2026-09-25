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
    const res = await apiClient.post("/auth/register", {
      email,
      password,
      firstName,
      lastName,
    });
    return res;
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
   * Verify email or action using 6-digit numeric OTP
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} payload.otp
   * @param {string} [payload.purpose="email_verification"]
   * @returns {Promise<Object>} Backend response with user
   */
  async verifyOtp({ email, otp, purpose = "email_verification" }) {
    return apiClient.post("/auth/verify-otp", {
      email,
      otp,
      purpose,
    });
  },

  /**
   * Request resending OTP code to user's email address
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} [payload.purpose="email_verification"]
   * @returns {Promise<Object>} Backend response with cooldown status
   */
  async resendOtp({ email, purpose = "email_verification" }) {
    const res = await apiClient.post("/auth/resend-otp", {
      email,
      purpose,
    });
    return res;
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

  /**
   * Change password for the currently authenticated user
   * @param {Object} payload
   * @param {string} payload.currentPassword
   * @param {string} payload.newPassword
   * @param {string} [payload.confirmPassword]
   * @returns {Promise<Object>} Backend response
   */
  async changePassword({ currentPassword, newPassword, confirmPassword }) {
    return apiClient.post("/auth/change-password", {
      currentPassword,
      newPassword,
      confirmPassword,
    });
  },

  /**
   * Request email OTP code for passwordless email login
   * @param {Object} payload
   * @param {string} payload.email
   * @returns {Promise<Object>} Backend response
   */
  async requestEmailLoginOtp({ email }) {
    return apiClient.post("/auth/login/email-otp/request", { email });
  },

  /**
   * Verify email OTP code for passwordless email login
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} payload.otp
   * @returns {Promise<Object>} Backend response
   */
  async verifyEmailLoginOtp({ email, otp }) {
    return apiClient.post("/auth/login/email-otp/verify", { email, otp });
  },

  /**
   * Request phone OTP code for mobile login
   * @param {Object} payload
   * @param {string} payload.phone
   * @returns {Promise<Object>} Backend response
   */
  async requestPhoneLoginOtp({ phone }) {
    return apiClient.post("/auth/login/phone-otp/request", { phone });
  },

  /**
   * Verify phone OTP code for mobile login
   * @param {Object} payload
   * @param {string} payload.phone
   * @param {string} payload.otp
   * @returns {Promise<Object>} Backend response
   */
  async verifyPhoneLoginOtp({ phone, otp }) {
    return apiClient.post("/auth/login/phone-otp/verify", { phone, otp });
  },

  /**
   * Request mobile registration OTP
   * @param {Object} payload
   * @param {string} payload.phone
   * @param {string} payload.firstName
   * @param {string} [payload.lastName]
   * @returns {Promise<Object>} Backend response
   */
  async requestPhoneRegister({ phone, firstName, lastName }) {
    return apiClient.post("/auth/register/phone/request", {
      phone,
      firstName,
      lastName,
    });
  },

  /**
   * Verify mobile registration OTP and establish session
   * @param {Object} payload
   * @param {string} payload.phone
   * @param {string} payload.otp
   * @param {string} payload.firstName
   * @param {string} [payload.lastName]
   * @returns {Promise<Object>} Backend response
   */
  async verifyPhoneRegister({ phone, otp, firstName, lastName }) {
    return apiClient.post("/auth/register/phone/verify", {
      phone,
      otp,
      firstName,
      lastName,
    });
  },

  /**
   * Authenticate customer with server-side verified Google ID token
   * @param {Object} payload
   * @param {string} payload.idToken
   * @returns {Promise<Object>} Backend response
   */
  async loginWithGoogle({ idToken }) {
    return apiClient.post("/auth/google", { idToken });
  },

  /**
   * Request email change verification OTP (authenticated customer)
   * @param {Object} payload
   * @param {string} payload.newEmail
   * @returns {Promise<Object>} Backend response
   */
  async requestChangeEmail({ newEmail }) {
    return apiClient.post("/auth/change-email/request", { newEmail });
  },

  /**
   * Verify email change OTP (authenticated customer)
   * @param {Object} payload
   * @param {string} payload.newEmail
   * @param {string} payload.otp
   * @returns {Promise<Object>} Backend response
   */
  async verifyChangeEmail({ newEmail, otp }) {
    return apiClient.post("/auth/change-email/verify", { newEmail, otp });
  },

  /**
   * Request mobile phone change verification OTP (authenticated customer)
   * @param {Object} payload
   * @param {string} payload.newPhone
   * @returns {Promise<Object>} Backend response
   */
  async requestChangePhone({ newPhone }) {
    return apiClient.post("/auth/change-phone/request", { newPhone });
  },

  /**
   * Verify mobile phone change OTP (authenticated customer)
   * @param {Object} payload
   * @param {string} payload.newPhone
   * @param {string} payload.otp
   * @returns {Promise<Object>} Backend response
   */
  async verifyChangePhone({ newPhone, otp }) {
    return apiClient.post("/auth/change-phone/verify", { newPhone, otp });
  },

  /**
   * Fetch currently available effective customer login methods
   * @returns {Promise<Object>} Safe boolean flags { emailPassword, emailOtp, mobileOtp, google }
   */
  async getLoginMethods() {
    const res = await apiClient.get("/auth/login-methods");
    return res?.data?.data || res?.data || res;
  },
};

export default authService;

