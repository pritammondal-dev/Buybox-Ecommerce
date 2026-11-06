/**
 * Dedicated In-Memory Token Manager for Vendor / Merchant Sessions
 *
 * Keeps the vendor short-lived access token in-memory only.
 * The long-lived refresh token is managed via httpOnly cookies
 * scoped to `/api/v1/vendor/auth`.
 */

let vendorAccessToken = null;
const listeners = new Set();

export const vendorTokenManager = {
  getAccessToken() {
    return vendorAccessToken;
  },

  setAccessToken(token) {
    vendorAccessToken = token || null;
    listeners.forEach((listener) => {
      try {
        listener(vendorAccessToken);
      } catch (err) {
        console.error("Error in vendor token change listener:", err);
      }
    });
  },

  clearAccessToken() {
    this.setAccessToken(null);
  },

  hasAccessToken() {
    return Boolean(vendorAccessToken);
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export default vendorTokenManager;

